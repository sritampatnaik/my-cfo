import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { TRANSACTION_KINDS } from "@/lib/banks";
import { query } from "@/lib/db";
import { asDate } from "@/lib/finance";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const kind = z.enum(TRANSACTION_KINDS);
const includeDrafts = z
  .boolean()
  .default(false)
  .describe(
    "Booked transactions are the reviewed source of truth. Only include drafts when the user asks about unreviewed or just-uploaded statements.",
  );
const direction = z
  .enum(["outflow", "inflow", "all"])
  .describe("outflow = money spent (negative amounts), inflow = money received (positive amounts)");

const rangeFields = {
  from: isoDate.describe("Inclusive start date"),
  to: isoDate.describe("Inclusive end date"),
};

// Tool inputs must stay a single flat object: providers reject `allOf` schemas from z.intersection.
function withRange<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({ ...rangeFields, ...shape })
    .refine((value: unknown) => {
      const { from, to } = value as { from: string; to: string };
      return from <= to;
    }, "from must be on or before to");
}

const range = withRange({});

function money(value: string | number | null) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

class Scope {
  readonly params: unknown[] = [];
  private readonly clauses: string[] = [];

  param(value: unknown) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  where(clause: string) {
    this.clauses.push(clause);
    return this;
  }

  ledger(options: { from?: string; to?: string; includeDrafts?: boolean; direction?: "outflow" | "inflow" | "all" }) {
    if (options.from) this.where(`t.posted_on >= ${this.param(options.from)}`);
    if (options.to) this.where(`t.posted_on <= ${this.param(options.to)}`);
    if (!options.includeDrafts) this.where(`t.status = 'booked'`);
    if (options.direction === "outflow") this.where(`t.amount < 0`);
    if (options.direction === "inflow") this.where(`t.amount > 0`);
    return this;
  }

  get sql() {
    return this.clauses.length ? `where ${this.clauses.join(" and ")}` : "";
  }
}

const FROM_LEDGER = `from effective_transactions t join statements s on s.id = t.statement_id`;
const MERCHANT = `upper(regexp_replace(trim(t.description), '\\s+', ' ', 'g'))`;

export const getDataCoverage = tool({
  description:
    "Describe what financial data exists: date coverage, booked vs draft counts, statements, banks and the category list. Call this first when you don't know which period the user's data covers.",
  inputSchema: z.object({}),
  execute: async () => {
    const [totals] = await query<{
      earliest: Date | null;
      latest: Date | null;
      booked: string;
      drafts: string;
      unclassified: string;
    }>(
      `select min(posted_on) as earliest, max(posted_on) as latest,
              count(*) filter (where status = 'booked') as booked,
              count(*) filter (where status = 'draft') as drafts,
              count(*) filter (where kind is null) as unclassified
       from effective_transactions`,
    );
    const statements = await query<{ total: string; booked: string; banks: string[] | null; currencies: string[] | null }>(
      `select count(*) as total, count(*) filter (where booked_at is not null) as booked,
              array_remove(array_agg(distinct bank), null) as banks,
              (select array_agg(distinct currency) from transactions) as currencies
       from statements`,
    );
    return {
      earliestDate: totals?.earliest ? asDate(totals.earliest) : null,
      latestDate: totals?.latest ? asDate(totals.latest) : null,
      bookedTransactions: Number(totals?.booked ?? 0),
      draftTransactions: Number(totals?.drafts ?? 0),
      unclassifiedTransactions: Number(totals?.unclassified ?? 0),
      statements: { total: Number(statements[0]?.total ?? 0), booked: Number(statements[0]?.booked ?? 0) },
      banks: statements[0]?.banks ?? [],
      currencies: statements[0]?.currencies ?? [],
      categories: TRANSACTION_KINDS,
    };
  },
});

export const getFinancialSummary = tool({
  description:
    "Headline totals for a date range: inflows, outflows, net cash flow, savings rate, average monthly spend and the largest single outflow.",
  inputSchema: withRange({ includeDrafts }),
  execute: async ({ from, to, includeDrafts }) => {
    const scope = new Scope().ledger({ from, to, includeDrafts });
    const [row] = await query<{
      inflows: string;
      outflows: string;
      net: string;
      count: string;
      months: string;
    }>(
      `select coalesce(sum(t.amount) filter (where t.amount > 0), 0) as inflows,
              coalesce(sum(t.amount) filter (where t.amount < 0), 0) as outflows,
              coalesce(sum(t.amount), 0) as net,
              count(*) as count,
              count(distinct to_char(t.posted_on, 'YYYY-MM')) as months
       ${FROM_LEDGER} ${scope.sql}`,
      scope.params,
    );
    const largestScope = new Scope().ledger({ from, to, includeDrafts, direction: "outflow" });
    const [largest] = await query<{ posted_on: Date; description: string; amount: string; kind: string | null }>(
      `select t.posted_on, t.description, t.amount, t.kind ${FROM_LEDGER} ${largestScope.sql}
       order by t.amount asc limit 1`,
      largestScope.params,
    );
    const inflows = money(row?.inflows ?? 0);
    const outflows = money(row?.outflows ?? 0);
    const months = Number(row?.months ?? 0);
    return {
      from,
      to,
      inflows,
      outflows,
      net: money(row?.net ?? 0),
      transactionCount: Number(row?.count ?? 0),
      monthsWithActivity: months,
      averageMonthlyOutflow: months ? money(outflows / months) : 0,
      savingsRate: inflows > 0 ? Math.round(((inflows + outflows) / inflows) * 1000) / 10 : null,
      largestOutflow: largest
        ? { date: asDate(largest.posted_on), description: largest.description, amount: money(largest.amount), kind: largest.kind }
        : null,
    };
  },
});

export const getSpendingByCategory = tool({
  description: "Totals per category for a date range, with each category's share of the total.",
  inputSchema: withRange({ direction: direction.default("outflow"), includeDrafts }),
  execute: async ({ from, to, direction, includeDrafts }) => {
    const scope = new Scope().ledger({ from, to, includeDrafts, direction });
    const rows = await query<{ kind: string; total: string; count: string }>(
      `select coalesce(t.kind, 'Unclassified') as kind, sum(t.amount) as total, count(*) as count
       ${FROM_LEDGER} ${scope.sql}
       group by 1 order by abs(sum(t.amount)) desc`,
      scope.params,
    );
    const grand = rows.reduce((sum, row) => sum + Math.abs(Number(row.total)), 0);
    return {
      from,
      to,
      direction,
      total: money(rows.reduce((sum, row) => sum + Number(row.total), 0)),
      categories: rows.map((row) => ({
        category: row.kind,
        total: money(row.total),
        count: Number(row.count),
        sharePercent: grand ? Math.round((Math.abs(Number(row.total)) / grand) * 1000) / 10 : 0,
      })),
    };
  },
});

export const getMonthlyTrend = tool({
  description: "Month-by-month inflows, outflows and net for a date range, optionally for a single category.",
  inputSchema: withRange({ category: kind.optional(), includeDrafts }),
  execute: async ({ from, to, category, includeDrafts }) => {
    const scope = new Scope().ledger({ from, to, includeDrafts });
    if (category) scope.where(`t.kind = ${scope.param(category)}`);
    const rows = await query<{ month: string; inflows: string; outflows: string; net: string; count: string }>(
      `select to_char(t.posted_on, 'YYYY-MM') as month,
              coalesce(sum(t.amount) filter (where t.amount > 0), 0) as inflows,
              coalesce(sum(t.amount) filter (where t.amount < 0), 0) as outflows,
              sum(t.amount) as net, count(*) as count
       ${FROM_LEDGER} ${scope.sql}
       group by 1 order by 1`,
      scope.params,
    );
    return {
      from,
      to,
      category: category ?? null,
      months: rows.map((row) => ({
        month: row.month,
        inflows: money(row.inflows),
        outflows: money(row.outflows),
        net: money(row.net),
        count: Number(row.count),
      })),
    };
  },
});

export const searchTransactions = tool({
  description:
    "Find individual transactions by date range, category, merchant text, amount or bank. Returns the matching count and total plus up to `limit` rows.",
  inputSchema: z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    categories: z.array(kind).optional(),
    text: z.string().max(100).optional().describe("Case-insensitive match against the description"),
    direction: direction.default("all"),
    minAmount: z.number().nonnegative().optional().describe("Minimum absolute amount"),
    maxAmount: z.number().nonnegative().optional().describe("Maximum absolute amount"),
    bank: z.string().max(30).optional().describe("Bank id, e.g. dbs, ocbc, uob"),
    sortBy: z.enum(["date", "amount"]).default("date").describe("amount sorts by largest absolute value"),
    limit: z.number().int().min(1).max(100).default(25),
    includeDrafts,
  }),
  execute: async (input) => {
    const scope = new Scope().ledger(input);
    if (input.categories?.length) scope.where(`t.kind = any(${scope.param(input.categories)}::text[])`);
    if (input.text) {
      const escaped = input.text.replace(/[\\%_]/g, (char) => `\\${char}`);
      scope.where(`t.description ilike ${scope.param(`%${escaped}%`)}`);
    }
    if (input.minAmount !== undefined) scope.where(`abs(t.amount) >= ${scope.param(input.minAmount)}`);
    if (input.maxAmount !== undefined) scope.where(`abs(t.amount) <= ${scope.param(input.maxAmount)}`);
    if (input.bank) scope.where(`s.bank = ${scope.param(input.bank.toLowerCase())}`);

    const [aggregate] = await query<{ count: string; total: string }>(
      `select count(*) as count, coalesce(sum(t.amount), 0) as total ${FROM_LEDGER} ${scope.sql}`,
      scope.params,
    );
    const order = input.sortBy === "amount" ? "abs(t.amount) desc" : "t.posted_on desc, t.created_at desc";
    const limit = scope.param(input.limit);
    const rows = await query<{
      posted_on: Date;
      description: string;
      amount: string;
      currency: string;
      kind: string | null;
      status: string;
      bank: string | null;
    }>(
      `select t.posted_on, t.description, t.amount, t.currency, t.kind, t.status, s.bank
       ${FROM_LEDGER} ${scope.sql} order by ${order} limit ${limit}`,
      scope.params,
    );
    return {
      matched: Number(aggregate?.count ?? 0),
      total: money(aggregate?.total ?? 0),
      returned: rows.length,
      transactions: rows.map((row) => ({
        date: asDate(row.posted_on),
        description: row.description,
        amount: money(row.amount),
        currency: row.currency,
        category: row.kind ?? "Unclassified",
        bank: row.bank,
        status: row.status,
      })),
    };
  },
});

export const getTopMerchants = tool({
  description: "Rank merchants/payees by total amount for a date range.",
  inputSchema: withRange({
    direction: direction.default("outflow"),
    category: kind.optional(),
    limit: z.number().int().min(1).max(50).default(10),
    includeDrafts,
  }),
  execute: async ({ from, to, direction, category, limit, includeDrafts }) => {
    const scope = new Scope().ledger({ from, to, includeDrafts, direction });
    if (category) scope.where(`t.kind = ${scope.param(category)}`);
    const limitParam = scope.param(limit);
    const rows = await query<{ merchant: string; total: string; count: string; last_date: Date; kinds: string[] }>(
      `select ${MERCHANT} as merchant, sum(t.amount) as total, count(*) as count,
              max(t.posted_on) as last_date, array_agg(distinct coalesce(t.kind, 'Unclassified')) as kinds
       ${FROM_LEDGER} ${scope.sql}
       group by 1 order by abs(sum(t.amount)) desc limit ${limitParam}`,
      scope.params,
    );
    return {
      from,
      to,
      merchants: rows.map((row) => ({
        merchant: row.merchant,
        total: money(row.total),
        count: Number(row.count),
        lastDate: asDate(row.last_date),
        categories: row.kinds,
      })),
    };
  },
});

export const comparePeriods = tool({
  description:
    "Compare two date ranges category by category (e.g. this month vs last month, or this year vs last year).",
  inputSchema: z.object({ current: range, previous: range, direction: direction.default("outflow"), includeDrafts }),
  execute: async ({ current, previous, direction, includeDrafts }) => {
    const scope = new Scope().ledger({ includeDrafts, direction });
    const cf = scope.param(current.from);
    const ct = scope.param(current.to);
    const pf = scope.param(previous.from);
    const pt = scope.param(previous.to);
    scope.where(`((t.posted_on between ${cf} and ${ct}) or (t.posted_on between ${pf} and ${pt}))`);
    const rows = await query<{ kind: string; current: string; previous: string }>(
      `select coalesce(t.kind, 'Unclassified') as kind,
              coalesce(sum(t.amount) filter (where t.posted_on between ${cf} and ${ct}), 0) as current,
              coalesce(sum(t.amount) filter (where t.posted_on between ${pf} and ${pt}), 0) as previous
       ${FROM_LEDGER} ${scope.sql}
       group by 1`,
      scope.params,
    );
    // Outflows are compared as positive spend so that a positive change always means "spent more".
    const sign = direction === "outflow" ? -1 : 1;
    const categories = rows
      .map((row) => {
        const now = money(sign * Number(row.current));
        const before = money(sign * Number(row.previous));
        return {
          category: row.kind,
          current: now,
          previous: before,
          change: money(now - before),
          changePercent: before ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null,
        };
      })
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const currentTotal = money(categories.reduce((sum, row) => sum + row.current, 0));
    const previousTotal = money(categories.reduce((sum, row) => sum + row.previous, 0));
    return {
      current,
      previous,
      direction,
      amounts: direction === "outflow" ? "positive spend amounts" : "signed amounts",
      currentTotal,
      previousTotal,
      change: money(currentTotal - previousTotal),
      categories,
    };
  },
});

export const listStatements = tool({
  description:
    "List uploaded bank statements with bank, statement month, booking status and how many transactions still need a category.",
  inputSchema: z.object({ status: z.enum(["all", "booked", "draft"]).default("all") }),
  execute: async ({ status }) => {
    const filter = status === "booked" ? "where s.booked_at is not null" : status === "draft" ? "where s.booked_at is null" : "";
    const rows = await query<{
      filename: string;
      bank: string | null;
      period_year: number | null;
      period_month: number | null;
      booked_at: Date | null;
      transactions: string;
      unclassified: string;
      net: string | null;
    }>(
      `select s.filename, s.bank, s.period_year, s.period_month, s.booked_at,
              count(t.id) as transactions,
              count(t.id) filter (where t.kind is null) as unclassified,
              sum(t.amount) as net
       from statements s left join effective_transactions t on t.statement_id = s.id
       ${filter}
       group by s.id order by s.period_year desc nulls last, s.period_month desc nulls last, s.uploaded_at desc
       limit 50`,
    );
    return {
      statements: rows.map((row) => ({
        file: row.filename,
        bank: row.bank,
        month: row.period_year && row.period_month ? `${row.period_year}-${String(row.period_month).padStart(2, "0")}` : null,
        status: row.booked_at ? "booked" : "draft",
        bookedAt: row.booked_at ? row.booked_at.toISOString() : null,
        transactions: Number(row.transactions),
        unclassified: Number(row.unclassified),
        net: money(row.net),
      })),
    };
  },
});

export const findRecurringPayments = tool({
  description:
    "Detect recurring payments such as subscriptions, bills and rent: merchants charged in at least `minMonths` different months, with typical amount and consistency.",
  inputSchema: withRange({ minMonths: z.number().int().min(2).max(12).default(3), includeDrafts }),
  execute: async ({ from, to, minMonths, includeDrafts }) => {
    const scope = new Scope().ledger({ from, to, includeDrafts, direction: "outflow" });
    const min = scope.param(minMonths);
    const rows = await query<{
      merchant: string;
      months: string;
      count: string;
      average: string;
      spread: string | null;
      total: string;
      last_date: Date;
      kind: string | null;
    }>(
      `select ${MERCHANT} as merchant,
              count(distinct to_char(t.posted_on, 'YYYY-MM')) as months,
              count(*) as count, avg(t.amount) as average, stddev_pop(t.amount) as spread,
              sum(t.amount) as total, max(t.posted_on) as last_date, mode() within group (order by t.kind) as kind
       ${FROM_LEDGER} ${scope.sql}
       group by 1
       having count(distinct to_char(t.posted_on, 'YYYY-MM')) >= ${min}
       order by abs(sum(t.amount)) desc limit 30`,
      scope.params,
    );
    return {
      from,
      to,
      recurring: rows.map((row) => {
        const average = Number(row.average);
        const spread = Number(row.spread ?? 0);
        return {
          merchant: row.merchant,
          category: row.kind ?? "Unclassified",
          monthsSeen: Number(row.months),
          charges: Number(row.count),
          typicalAmount: money(average),
          fixedAmount: average !== 0 && spread / Math.abs(average) < 0.05,
          total: money(row.total),
          lastCharged: asDate(row.last_date),
        };
      }),
    };
  },
});

export const financeTools = {
  getDataCoverage,
  getFinancialSummary,
  getSpendingByCategory,
  getMonthlyTrend,
  searchTransactions,
  getTopMerchants,
  comparePeriods,
  listStatements,
  findRecurringPayments,
};

import { query } from "@/lib/db";

export type Summary = {
  inflows: number;
  outflows: number;
  net: number;
  count: number;
  drafts: number;
  kinds: { kind: string; count: number; total: number }[];
  months: { month: string; kinds: { kind: string; total: number }[] }[];
};

export type TransactionStatus = "draft" | "booked";
export type EntryType = "original" | "reversal" | "adjustment";

export type TransactionRow = {
  id: string;
  postedOn: string;
  description: string;
  amount: number;
  currency: string;
  kind: string | null;
  confidence: number | null;
  bank: string | null;
  filename: string;
  status: TransactionStatus;
  entryType: EntryType;
  adjustsId: string | null;
  reversed: boolean;
};

export function asDate(value: unknown) {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

export async function getSummary(from: string, to: string): Promise<Summary> {
  const [totals] = await query<{
    inflows: string;
    outflows: string;
    net: string;
    count: string;
    drafts: string;
  }>(
    `select
       coalesce(sum(amount) filter (where status = 'booked' and amount > 0), 0) as inflows,
       coalesce(sum(amount) filter (where status = 'booked' and amount < 0), 0) as outflows,
       coalesce(sum(amount) filter (where status = 'booked'), 0) as net,
       count(*) filter (where status = 'booked' and entry_type = 'original') as count,
       count(*) filter (where status = 'draft') as drafts
     from transactions
     where posted_on >= $1 and posted_on <= $2`,
    [from, to],
  );
  const kinds = await query<{ kind: string | null; count: string; total: string }>(
    `select coalesce(kind, 'Unclassified') as kind,
            count(*) filter (where entry_type <> 'reversal') - count(*) filter (where entry_type = 'reversal') as count,
            coalesce(sum(amount), 0) as total
     from transactions
     where posted_on >= $1 and posted_on <= $2 and status = 'booked'
     group by 1
     having count(*) filter (where entry_type <> 'reversal') > count(*) filter (where entry_type = 'reversal')
     order by abs(sum(amount)) desc`,
    [from, to],
  );

  const monthly = await query<{ month: string; kind: string | null; total: string }>(
    `select to_char(posted_on, 'YYYY-MM') as month,
            coalesce(kind, 'Unclassified') as kind,
            coalesce(sum(amount), 0) as total
     from transactions
     where posted_on >= $1 and posted_on <= $2 and status = 'booked'
     group by 1, 2
     order by 1, 2`,
    [from, to],
  );
  const byMonth = new Map<string, { kind: string; total: number }[]>();
  for (const row of monthly) {
    const kindsForMonth = byMonth.get(row.month) ?? [];
    kindsForMonth.push({ kind: row.kind ?? "Unclassified", total: Number(row.total) });
    byMonth.set(row.month, kindsForMonth);
  }

  return {
    inflows: Number(totals?.inflows ?? 0),
    outflows: Number(totals?.outflows ?? 0),
    net: Number(totals?.net ?? 0),
    count: Number(totals?.count ?? 0),
    drafts: Number(totals?.drafts ?? 0),
    kinds: kinds.map((row) => ({
      kind: row.kind ?? "Unclassified",
      count: Number(row.count),
      total: Number(row.total),
    })),
    months: [...byMonth.entries()].map(([month, monthKinds]) => ({ month, kinds: monthKinds })),
  };
}

type Row = {
  id: string;
  posted_on: Date;
  description: string;
  amount: string;
  currency: string;
  kind: string | null;
  jev_confidence: string | null;
  bank: string | null;
  filename: string;
  status: TransactionStatus;
  entry_type: EntryType;
  adjusts_id: string | null;
  reversed: boolean;
};

const SELECT_ROWS = `select t.id, t.posted_on, t.description, t.amount, t.currency, t.kind, t.jev_confidence,
         t.status, t.entry_type, t.adjusts_id,
         exists (select 1 from transactions r where r.adjusts_id = t.id and r.entry_type = 'reversal') as reversed,
         s.bank, s.filename
  from transactions t
  join statements s on s.id = t.statement_id`;

const ORDER_ROWS = `order by t.posted_on desc, coalesce(t.adjusts_id, t.id), t.created_at`;

function toRow(row: Row): TransactionRow {
  return {
    id: row.id,
    postedOn: asDate(row.posted_on),
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    kind: row.kind,
    confidence: row.jev_confidence === null ? null : Number(row.jev_confidence),
    bank: row.bank,
    filename: row.filename,
    status: row.status,
    entryType: row.entry_type,
    adjustsId: row.adjusts_id,
    reversed: row.reversed,
  };
}

export async function listTransactions(from: string, to: string): Promise<TransactionRow[]> {
  const rows = await query<Row>(
    `${SELECT_ROWS}
     where t.posted_on >= $1 and t.posted_on <= $2
     ${ORDER_ROWS}`,
    [from, to],
  );
  return rows.map(toRow);
}

export async function listStatementTransactions(statementId: string): Promise<TransactionRow[]> {
  const rows = await query<Row>(
    `${SELECT_ROWS}
     where t.statement_id = $1
     ${ORDER_ROWS}`,
    [statementId],
  );
  return rows.map(toRow);
}

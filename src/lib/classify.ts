import { TRANSACTION_KINDS, type TransactionKind } from "@/lib/banks";

export type ClassifiedTransaction = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  postedOn: string;
};

export type Classification = {
  id: string;
  kind: TransactionKind;
  confidence: number | null;
};

const KIND_CRITERIA: Record<TransactionKind, string> = {
  Income: "Salary, refunds, interest, or other money received",
  Transfer: "Moving money between the customer's own accounts, or paying a card from a deposit account",
  Groceries: "Supermarkets, wet markets, and convenience stores",
  Dining: "Restaurants, cafes, hawkers, and food delivery",
  Transport: "Ride-hailing, taxi, MRT, bus, fuel, parking, or ERP",
  Housing: "Rent, mortgage, or property charges",
  Utilities: "Electricity, water, gas, internet, or mobile",
  Shopping: "Retail, online stores, clothing, or electronics",
  Healthcare: "Clinics, pharmacy, or medical charges",
  Fees: "Bank fees, interest charges, or card annual fees",
  Cash: "ATM withdrawal or cash deposit",
  Other: "Does not clearly fit the types above",
};

const BATCH_SIZE = 20;

export async function classifyTransactions(
  rows: ClassifiedTransaction[],
): Promise<Classification[]> {
  const apiKey: string = process.env.TYPESAFE_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("Add TYPESAFE_API_KEY to .env.local, then try again.");
  }
  if (rows.length === 0) return [];

  const results: Classification[] = [];
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    results.push(...(await classifyBatch(apiKey, batch)));
  }
  return results;
}

async function classifyBatch(
  apiKey: string,
  rows: ClassifiedTransaction[],
): Promise<Classification[]> {
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "jev-latest",
      state: {
        transactions: rows.map((row) => ({
          id: row.id,
          description: row.description,
          amount: row.amount,
          currency: row.currency,
          postedOn: row.postedOn,
        })),
      },
      questions: Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            type: "choice",
            instructions: {
              transaction_id: row.id,
              question:
                "Which personal-finance type best describes the transaction whose id is `transaction_id`?",
            },
            criteria: KIND_CRITERIA,
          },
        ]),
      ),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Jev could not classify these transactions (${response.status}). ${detail.slice(0, 180)}`);
  }

  const body = (await response.json()) as { answers?: Record<string, unknown> };
  return rows.map((row) => {
    const answer = body.answers?.[row.id];
    return {
      id: row.id,
      kind: readChoice(answer),
      confidence: readConfidence(answer),
    };
  });
}

function readChoice(answer: unknown): TransactionKind {
  const candidate = firstString(answer, ["choice", "answer", "value", "label"]);
  const match = TRANSACTION_KINDS.find(
    (kind) => kind.toLowerCase() === candidate?.toLowerCase(),
  );
  return match ?? "Other";
}

function readConfidence(answer: unknown) {
  const value = firstNumber(answer, ["confidence"]);
  return value === null ? null : Math.max(0, Math.min(1, value));
}

function firstString(value: unknown, keys: string[]) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key];
  }
  return null;
}

function firstNumber(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const number = Number(record[key]);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

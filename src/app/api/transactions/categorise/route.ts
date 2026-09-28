import { NextResponse } from "next/server";
import { classifyTransactions } from "@/lib/classify";
import { query } from "@/lib/db";
import { asDate } from "@/lib/finance";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json()) as { from?: string; to?: string; statementId?: string };
  const statementId = body.statementId ?? "";
  const from = body.from ?? "";
  const to = body.to ?? "";
  const scoped = Boolean(statementId);
  if (!scoped && (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
    return NextResponse.json({ error: "Use dates in YYYY-MM-DD format." }, { status: 400 });
  }

  const rows = await query<{
    id: string;
    description: string;
    amount: string;
    currency: string;
    posted_on: Date | string;
  }>(
    scoped
      ? `select id, description, amount, currency, posted_on
         from transactions
         where statement_id = $1 and kind is null and status = 'draft'
         order by posted_on`
      : `select id, description, amount, currency, posted_on
         from transactions
         where posted_on >= $1 and posted_on <= $2 and kind is null and status = 'draft'
         order by posted_on`,
    scoped ? [statementId] : [from, to],
  );

  const classified = await classifyTransactions(
    rows.map((row) => ({
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      postedOn: asDate(row.posted_on),
    })),
  );

  for (const item of classified) {
    await query(
      `update transactions set kind = $1, jev_confidence = $2 where id = $3 and status = 'draft'`,
      [item.kind, item.confidence, item.id],
    );
  }

  if (scoped && classified.length > 0) {
    await query(`update statements set status = 'ready' where id = $1 and booked_at is null`, [statementId]);
  }

  return NextResponse.json({ count: classified.length });
}

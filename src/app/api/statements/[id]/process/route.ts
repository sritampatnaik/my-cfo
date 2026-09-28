import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { extractTransactions } from "@/lib/extract";
import { findBank } from "@/lib/banks";
import { statementFiles } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

type StoredRow = {
  posted_on: Date | string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { bank?: string };
  const bank = body.bank ? findBank(body.bank) : undefined;
  if (body.bank && !bank) {
    return NextResponse.json({ error: "Pick a bank." }, { status: 400 });
  }

  const statements = await query<{ object_key: string; filename: string; booked_at: Date | null }>(
    `select object_key, filename, booked_at from statements where id = $1`,
    [id],
  );
  const statement = statements[0];
  if (!statement) {
    return NextResponse.json({ error: "That statement is no longer available." }, { status: 404 });
  }
  if (statement.booked_at) {
    return NextResponse.json({ error: "This statement is booked and can no longer be re-read." }, { status: 409 });
  }

  await query(
    `update statements set status = 'processing', bank = coalesce($1, bank) where id = $2 and booked_at is null`,
    [bank?.id ?? null, id],
  );

  try {
    let dates = await query<StoredRow>(
      `select posted_on from transactions where statement_id = $1`,
      [id],
    );

    if (dates.length === 0) {
      const file = await statementFiles.download(statement.object_key);
      const pdf = Buffer.from(await file.arrayBuffer());
      const extracted = await extractTransactions(pdf, statement.filename, bank?.id);
      for (const row of extracted) {
        await query(
          `insert into transactions (statement_id, posted_on, description, amount, currency)
           values ($1, $2, $3, $4, $5)`,
          [id, row.postedOn, row.description, row.amount, row.currency],
        );
      }
      dates = extracted.map((row) => ({ posted_on: row.postedOn }));
    }

    const period = dominantPeriod(dates.map((row) => postedOn(row.posted_on)));
    if (period) {
      await query(
        `update statements
         set period_year = coalesce(period_year, $1),
             period_month = coalesce(period_month, $2),
             status = case when status in ('uploaded', 'processing') then 'detected' else status end
         where id = $3`,
        [period.year, period.month, id],
      );
    } else {
      await query(
        `update statements set status = 'detected' where id = $1 and status in ('uploaded', 'processing')`,
        [id],
      );
    }
    return NextResponse.json({ count: dates.length, ...(period ?? {}) });
  } catch (error) {
    await query(`update statements set status = 'error' where id = $1`, [id]);
    const message = error instanceof Error ? error.message : "Could not read that statement.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function postedOn(value: Date | string) {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function dominantPeriod(dates: string[]) {
  let best = "";
  for (const date of dates) {
    const key = date.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(key) && key > best) best = key;
  }
  if (!best) return null;
  const [year, month] = best.split("-").map(Number);
  return { year, month };
}

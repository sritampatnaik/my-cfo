import { NextResponse } from "next/server";
import { findBank } from "@/lib/banks";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as { year?: number; month?: number; bank?: string };
  const bank = body.bank ? findBank(body.bank) : undefined;
  if (body.bank && !bank) {
    return NextResponse.json({ error: "Pick a bank." }, { status: 400 });
  }
  const hasPeriod = body.year !== undefined || body.month !== undefined;
  const year = Number(body.year);
  const month = Number(body.month);
  if (hasPeriod && (!Number.isInteger(year) || year < 1990 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12)) {
    return NextResponse.json({ error: "Choose a statement month and year." }, { status: 400 });
  }
  if (!bank && !hasPeriod) {
    return NextResponse.json({ error: "Pick a bank." }, { status: 400 });
  }

  const existing = await query<{ booked_at: Date | null }>(
    `select booked_at from statements where id = $1`,
    [id],
  );
  if (!existing[0]) {
    return NextResponse.json({ error: "That statement is no longer available." }, { status: 404 });
  }
  if (existing[0].booked_at) {
    return NextResponse.json({ error: "This statement is booked and can no longer be changed." }, { status: 409 });
  }

  if (bank) {
    await query(`update statements set bank = $1 where id = $2 and booked_at is null`, [bank.id, id]);
  }
  if (hasPeriod) {
    await query(
      `update statements
       set period_year = $1,
           period_month = $2,
           status = case when status = 'ready' then status else 'extracted' end
       where id = $3 and booked_at is null`,
      [year, month, id],
    );
  }
  return NextResponse.json({ id, year, month });
}

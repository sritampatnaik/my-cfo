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

  if (bank) {
    await query(`update statements set bank = $1 where id = $2`, [bank.id, id]);
  }
  if (hasPeriod) {
    await query(
      `update statements
       set period_year = $1,
           period_month = $2,
           status = case when status = 'ready' then status else 'extracted' end
       where id = $3`,
      [year, month, id],
    );
  }
  const updated = await query<{ id: string }>(`select id from statements where id = $1`, [id]);
  if (!updated[0]) {
    return NextResponse.json({ error: "That statement is no longer available." }, { status: 404 });
  }
  return NextResponse.json({ id, year, month });
}

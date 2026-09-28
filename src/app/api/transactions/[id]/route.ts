import { NextResponse } from "next/server";
import { TRANSACTION_KINDS } from "@/lib/banks";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "That transaction is no longer available." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { kind?: string } | null;
  const kind = TRANSACTION_KINDS.find((option) => option === body?.kind);
  if (!kind) {
    return NextResponse.json({ error: "Choose a transaction type." }, { status: 400 });
  }

  const updated = await query<{ id: string }>(
    `update transactions set kind = $1, jev_confidence = null
     where id = $2 and status = 'draft'
     returning id`,
    [kind, id],
  );
  if (!updated[0]) {
    const existing = await query<{ status: string }>(`select status from transactions where id = $1`, [id]);
    if (existing[0]?.status === "booked") {
      return NextResponse.json(
        { error: "This transaction is booked. Reclassify it to post a correcting entry." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "That transaction is no longer available." }, { status: 404 });
  }
  return NextResponse.json({ id, kind });
}

import { NextResponse } from "next/server";
import { TRANSACTION_KINDS } from "@/lib/banks";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";

class ReclassifyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(
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

  try {
    const entries = await withTransaction(async (tx) => {
      const [original] = await tx<{
        kind: string | null;
        status: string;
        entry_type: string;
        reversed: boolean;
      }>(
        `select kind, status, entry_type,
                exists (select 1 from transactions r where r.adjusts_id = t.id and r.entry_type = 'reversal') as reversed
         from transactions t
         where id = $1
         for update`,
        [id],
      );
      if (!original) throw new ReclassifyError("That transaction is no longer available.", 404);
      if (original.status !== "booked") {
        throw new ReclassifyError("Only booked transactions are reclassified. Change the type directly.", 409);
      }
      if (original.entry_type === "reversal") {
        throw new ReclassifyError("Reversing entries can't be reclassified.", 409);
      }
      if (original.reversed) {
        throw new ReclassifyError("This transaction has already been reversed. Reclassify its adjustment instead.", 409);
      }
      if (original.kind === kind) {
        throw new ReclassifyError(`This transaction is already ${kind}.`, 400);
      }

      const [reversal] = await tx<{ id: string }>(
        `insert into transactions
           (statement_id, posted_on, description, amount, currency, kind, status, booked_at, entry_type, adjusts_id)
         select statement_id, posted_on, description, -amount, currency, kind, 'booked', now(), 'reversal', id
         from transactions where id = $1
         returning id`,
        [id],
      );
      const [adjustment] = await tx<{ id: string }>(
        `insert into transactions
           (statement_id, posted_on, description, amount, currency, kind, status, booked_at, entry_type, adjusts_id)
         select statement_id, posted_on, description, amount, currency, $2, 'booked', now(), 'adjustment', id
         from transactions where id = $1
         returning id`,
        [id, kind],
      );
      return { reversalId: reversal.id, adjustmentId: adjustment.id };
    });
    return NextResponse.json({ id, kind, ...entries });
  } catch (error) {
    if (error instanceof ReclassifyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

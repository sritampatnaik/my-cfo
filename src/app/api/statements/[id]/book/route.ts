import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";

class BookError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "That statement is no longer available." }, { status: 404 });
  }

  try {
    const result = await withTransaction(async (tx) => {
      const [statement] = await tx<{ booked_at: Date | null }>(
        `select booked_at from statements where id = $1 for update`,
        [id],
      );
      if (!statement) throw new BookError("That statement is no longer available.", 404);
      if (statement.booked_at) throw new BookError("This statement is already booked.", 409);

      const [counts] = await tx<{ total: string; unclassified: string }>(
        `select count(*) as total, count(*) filter (where kind is null) as unclassified
         from transactions where statement_id = $1 and status = 'draft'`,
        [id],
      );
      const total = Number(counts?.total ?? 0);
      const unclassified = Number(counts?.unclassified ?? 0);
      if (total === 0) throw new BookError("There are no transactions to book.", 400);
      if (unclassified > 0) {
        throw new BookError(
          `${unclassified} ${unclassified === 1 ? "transaction needs" : "transactions need"} a type before booking.`,
          400,
        );
      }

      const [booked] = await tx<{ booked_at: Date }>(
        `update statements set status = 'booked', booked_at = now() where id = $1 returning booked_at`,
        [id],
      );
      await tx(
        `update transactions set status = 'booked', booked_at = $2
         where statement_id = $1 and status = 'draft'`,
        [id, booked.booked_at],
      );
      return { count: total, bookedAt: booked.booked_at.toISOString() };
    });
    return NextResponse.json({ id, ...result });
  } catch (error) {
    if (error instanceof BookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

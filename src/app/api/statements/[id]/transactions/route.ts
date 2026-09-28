import { NextResponse } from "next/server";
import { listStatementTransactions } from "@/lib/finance";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const transactions = await listStatementTransactions(id);
  return NextResponse.json({ transactions });
}

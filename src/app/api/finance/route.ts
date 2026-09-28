import { NextResponse } from "next/server";
import { getSummary, listTransactions } from "@/lib/finance";

export const runtime = "nodejs";

function range(url: URL) {
  const today = new Date();
  const from = url.searchParams.get("from") || startOfMonth(today);
  const to = url.searchParams.get("to") || today.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return null;
  }
  return { from, to };
}

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(request: Request) {
  const selected = range(new URL(request.url));
  if (!selected) {
    return NextResponse.json({ error: "Use dates in YYYY-MM-DD format." }, { status: 400 });
  }
  const [summary, transactions] = await Promise.all([
    getSummary(selected.from, selected.to),
    listTransactions(selected.from, selected.to),
  ]);
  return NextResponse.json({ ...selected, summary, transactions });
}

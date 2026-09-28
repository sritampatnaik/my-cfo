import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { noteDuplicate } from "@/lib/filenames";
import { statementFiles } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const rows = await query<{
    id: string;
    filename: string;
    bank: string | null;
    status: string;
    period_year: number | null;
    period_month: number | null;
    uploaded_at: Date;
  }>(
    `select id, filename, bank, status, period_year, period_month, uploaded_at
     from statements
     order by uploaded_at desc`,
  );

  return NextResponse.json({
    statements: rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      bank: row.bank,
      status: row.status,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      uploadedAt: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : String(row.uploaded_at),
    })),
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF statement." }, { status: 400 });
  }
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "Only PDF e-statements can be uploaded." }, { status: 400 });
  }

  const previous = await query<{ filename: string }>(
    `select filename from statements order by uploaded_at desc`,
  );
  const noted = noteDuplicate(
    file.name,
    previous.map((row) => row.filename),
  );

  const id = randomUUID();
  const safeName = noted.notedName.replace(/[^\w.\-() ]+/g, "_") || "statement.pdf";
  const objectKey = `${id}/${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  await statementFiles.upload(objectKey, bytes, { contentType: "application/pdf" });
  try {
    await query(
      `insert into statements (id, filename, object_key) values ($1, $2, $3)`,
      [id, noted.notedName, objectKey],
    );
  } catch (error) {
    await statementFiles.delete(objectKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Could not save the statement.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    id,
    filename: noted.notedName,
    warning: noted.warning,
  });
}

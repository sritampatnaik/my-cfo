import OpenAI from "openai";
import { findBank } from "@/lib/banks";

export type ExtractedTransaction = {
  postedOn: string;
  description: string;
  amount: number;
  currency: string;
};

const prompt = `Extract every posted transaction from this bank e-statement PDF.
Return JSON only, with this shape:
{"currency":"SGD","transactions":[{"postedOn":"YYYY-MM-DD","description":"string","amount":0}]}
Rules:
- amount is a number. Money in is positive. Money out, payments, and fees are negative.
- postedOn is the transaction date, not the statement print date.
- description is the merchant or narration, without extra commentary.
- skip opening balances, closing balances, and page headers.
- if the statement currency is visible, use that ISO code. Otherwise use SGD.`;

export async function extractTransactions(
  pdf: Buffer,
  filename: string,
  bankId?: string,
): Promise<ExtractedTransaction[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Add OPENAI_API_KEY to .env.local, then try again.");
  }

  const bank = findBank(bankId ?? "");
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename,
            file_data: `data:application/pdf;base64,${pdf.toString("base64")}`,
          },
          {
            type: "input_text",
            text: bank
              ? `${prompt}\nThe customer says this statement is from ${bank.name}.`
              : prompt,
          },
        ],
      },
    ],
  });

  const parsed = parseExtraction(response.output_text);
  if (parsed.length === 0) {
    throw new Error("OpenAI did not find any transactions in that PDF.");
  }
  return parsed;
}

export function parseExtraction(text: string): ExtractedTransaction[] {
  const json = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("OpenAI did not return transaction JSON.");
  }
  const body = JSON.parse(json.slice(start, end + 1)) as {
    currency?: string;
    transactions?: Array<{
      postedOn?: string;
      description?: string;
      amount?: number | string;
    }>;
  };
  const currency = body.currency?.trim() || "SGD";
  return (body.transactions ?? [])
    .map((row) => {
      const postedOn = String(row.postedOn ?? "").slice(0, 10);
      const description = String(row.description ?? "").trim();
      const amount = Number(row.amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(postedOn) || !description || !Number.isFinite(amount)) {
        return null;
      }
      return { postedOn, description, amount, currency };
    })
    .filter((row): row is ExtractedTransaction => row !== null);
}

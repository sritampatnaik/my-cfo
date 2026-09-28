import { NextResponse } from "next/server";
import { listChatModels } from "@/lib/ai/models";

export const runtime = "nodejs";

export async function GET() {
  const models = await listChatModels();
  return NextResponse.json({ models, defaultModel: models[0]?.id ?? null });
}

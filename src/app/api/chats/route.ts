import { NextResponse } from "next/server";
import { listChats } from "@/lib/ai/chat-store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ chats: await listChats() });
}

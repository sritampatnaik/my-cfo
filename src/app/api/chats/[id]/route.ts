import { NextResponse } from "next/server";
import { CHAT_ID_PATTERN, deleteChat } from "@/lib/ai/chat-store";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!CHAT_ID_PATTERN.test(id) || !(await deleteChat(id))) {
    return NextResponse.json({ error: "That chat is no longer available." }, { status: 404 });
  }
  return NextResponse.json({ id });
}

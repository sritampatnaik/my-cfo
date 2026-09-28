import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const metadata = { title: "Ask CFO" };

export default async function NewChatPage() {
  await connection();
  const id = randomUUID();
  return <ChatWorkspace key={id} chatId={id} initialMessages={[]} />;
}

import { notFound } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import type { FinanceAgentUIMessage } from "@/lib/ai/agent";
import { CHAT_ID_PATTERN, loadChat } from "@/lib/ai/chat-store";

export const metadata = { title: "Ask CFO" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CHAT_ID_PATTERN.test(id)) notFound();
  const messages = (await loadChat(id)) as FinanceAgentUIMessage[];
  if (messages.length === 0) notFound();
  return <ChatWorkspace key={id} chatId={id} initialMessages={messages} />;
}

import "server-only";
import type { UIMessage } from "ai";
import { query, withTransaction } from "@/lib/db";

export const CHAT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

const TITLE_LENGTH = 60;

export function titleFrom(messages: UIMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser?.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "New chat";
  return text.length > TITLE_LENGTH ? `${text.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : text;
}

export async function loadChat(id: string): Promise<UIMessage[]> {
  const rows = await query<{ id: string; role: UIMessage["role"]; parts: UIMessage["parts"]; metadata: unknown }>(
    `select id, role, parts, metadata from chat_messages where chat_id = $1 order by position`,
    [id],
  );
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: row.parts,
    ...(row.metadata ? { metadata: row.metadata } : {}),
  }));
}

export async function saveChat({ id, messages, model }: { id: string; messages: UIMessage[]; model: string }) {
  await withTransaction(async (tx) => {
    await tx(
      `insert into chats (id, title, model) values ($1, $2, $3)
       on conflict (id) do update set model = excluded.model, updated_at = now()`,
      [id, titleFrom(messages), model],
    );
    await tx(`delete from chat_messages where chat_id = $1 and not (id = any($2::text[]))`, [
      id,
      messages.map((message) => message.id),
    ]);
    for (const [position, message] of messages.entries()) {
      await tx(
        `insert into chat_messages (id, chat_id, position, role, parts, metadata)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update
           set position = excluded.position, parts = excluded.parts, metadata = excluded.metadata
         where chat_messages.chat_id = excluded.chat_id`,
        [
          message.id,
          id,
          position,
          message.role,
          JSON.stringify(message.parts),
          message.metadata === undefined ? null : JSON.stringify(message.metadata),
        ],
      );
    }
  });
}

export async function listChats(limit = 50): Promise<ChatSummary[]> {
  const rows = await query<{ id: string; title: string; updated_at: Date }>(
    `select id, title, updated_at from chats order by updated_at desc limit $1`,
    [limit],
  );
  return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at.toISOString() }));
}

export async function deleteChat(id: string) {
  const rows = await query<{ id: string }>(`delete from chats where id = $1 returning id`, [id]);
  return rows.length > 0;
}

import {
  APICallError,
  consumeStream,
  createAgentUIStreamResponse,
  createIdGenerator,
  safeValidateUIMessages,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { chatMetadataSchema, createFinanceAgent, type FinanceAgentUIMessage } from "@/lib/ai/agent";
import { CHAT_ID_PATTERN, loadChat, saveChat } from "@/lib/ai/chat-store";
import { ModelConfigError, resolveChatModel } from "@/lib/ai/models";
import { financeTools } from "@/lib/ai/tools";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BODY_BYTES = 64_000;
const MAX_INPUT_CHARS = 4_000;
const CONTEXT_MESSAGES = 40;

const requestSchema = z.object({
  id: z.string().regex(CHAT_ID_PATTERN),
  model: z.string().max(80).optional(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal("user"),
    parts: z
      .array(z.object({ type: z.string() }).passthrough())
      .min(1)
      .max(20),
  }),
});

function errorMessage(error: unknown) {
  if (error instanceof ModelConfigError) return error.message;
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return "The AI provider rejected the credentials. Check NEON_AI_GATEWAY_TOKEN (or OPENAI_API_KEY).";
    }
    if (error.statusCode === 429) return "The AI provider is rate limiting requests. Wait a moment and try again.";
    if (error.statusCode === 404) return "That model isn't available on this gateway. Pick another model.";
    return "The AI provider had a problem answering. Try again, or switch models.";
  }
  return "Something went wrong while answering. Try again.";
}

export async function POST(request: Request) {
  const limited = rateLimit(`chat:${clientKey(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "You're sending messages too quickly. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "That message is too long." }, { status: 413 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That request wasn't valid." }, { status: 400 });
  }
  const { id, model: requestedModel } = parsed.data;
  const message = parsed.data.message as unknown as FinanceAgentUIMessage;
  const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
  if (!text.trim()) {
    return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  }
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Keep questions under ${MAX_INPUT_CHARS.toLocaleString()} characters.` },
      { status: 413 },
    );
  }

  let resolved: Awaited<ReturnType<typeof resolveChatModel>>;
  try {
    resolved = await resolveChatModel(requestedModel);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }

  const stored = await loadChat(id);
  let previous: FinanceAgentUIMessage[] = [];
  if (stored.length > 0) {
    const history = await safeValidateUIMessages<FinanceAgentUIMessage>({
      messages: stored,
      tools: financeTools,
      metadataSchema: chatMetadataSchema,
    });
    if (!history.success) {
      // Saving after a failed load would delete the stored messages, so refuse instead.
      console.error(`Chat ${id} history failed validation.`, history.error);
      return NextResponse.json(
        { error: "This conversation can't be continued after an update. Start a new chat." },
        { status: 409 },
      );
    }
    previous = history.data;
  }

  // Re-sending an existing message (regenerate or edit) replaces it and everything after it.
  const replaced = previous.findIndex((existing) => existing.id === message.id);
  const messages = [...(replaced === -1 ? previous : previous.slice(0, replaced)), message];

  let context = messages.slice(-CONTEXT_MESSAGES);
  while (context.length > 1 && context[0].role !== "user") context = context.slice(1);

  return createAgentUIStreamResponse({
    agent: createFinanceAgent(resolved.model),
    uiMessages: context,
    originalMessages: messages as UIMessage[] as FinanceAgentUIMessage[],
    abortSignal: request.signal,
    generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
    messageMetadata: ({ part }) => {
      if (part.type === "start") return { createdAt: Date.now(), model: resolved.id };
      if (part.type === "finish") return { model: resolved.id, totalTokens: part.totalUsage.totalTokens };
      return undefined;
    },
    onEnd: async ({ messages: finalMessages }) => {
      try {
        await saveChat({ id, messages: finalMessages, model: resolved.id });
      } catch (error) {
        console.error(`Could not save chat ${id}`, error);
      }
    },
    onError: (error) => {
      console.error(`Chat ${id} failed`, error);
      return errorMessage(error);
    },
    consumeSseStream: consumeStream,
  });
}

import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { createNeon } from "@neon/ai-sdk-provider";
import type { LanguageModel } from "ai";

export type ChatModel = {
  id: string;
  label: string;
  vendor: string;
  description: string;
};

type ProviderName = "neon" | "openai";

const CATALOG: Record<ProviderName, ChatModel[]> = {
  neon: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", vendor: "Anthropic", description: "Balanced analysis" },
    { id: "claude-opus-5", label: "Claude Opus 5", vendor: "Anthropic", description: "Deepest reasoning" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", vendor: "Anthropic", description: "Fastest answers" },
    { id: "gpt-5-5", label: "GPT-5.5", vendor: "OpenAI", description: "Strong all-rounder" },
    { id: "gpt-5-4-mini", label: "GPT-5.4 mini", vendor: "OpenAI", description: "Quick and cheap" },
    { id: "gemini-3-5-flash", label: "Gemini 3.5 Flash", vendor: "Google", description: "Fast with long context" },
  ],
  openai: [
    { id: "gpt-5.5", label: "GPT-5.5", vendor: "OpenAI", description: "Strong all-rounder" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", vendor: "OpenAI", description: "Quick and cheap" },
  ],
};

const CATALOG_TTL_MS = 5 * 60_000;
let cachedCatalog: { models: ChatModel[]; expires: number } | null = null;

function activeProvider(): ProviderName | null {
  if (process.env.NEON_AI_GATEWAY_TOKEN && process.env.NEON_AI_GATEWAY_BASE_URL) return "neon";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export class ModelConfigError extends Error {}

async function servedByGateway(): Promise<Set<string> | null> {
  try {
    const response = await fetch(`${process.env.NEON_AI_GATEWAY_BASE_URL}/v1/models`, {
      headers: { Authorization: `Bearer ${process.env.NEON_AI_GATEWAY_TOKEN}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { id: string; enabled?: boolean }[] };
    return new Set((body.data ?? []).filter((model) => model.enabled !== false).map((model) => model.id));
  } catch {
    return null;
  }
}

export async function listChatModels(): Promise<ChatModel[]> {
  const provider = activeProvider();
  if (!provider) return [];
  if (provider === "openai") return CATALOG.openai;
  if (cachedCatalog && cachedCatalog.expires > Date.now()) return cachedCatalog.models;

  const served = await servedByGateway();
  const available = served ? CATALOG.neon.filter((model) => served.has(model.id)) : [];
  // An unreachable or unexpectedly empty catalog shouldn't lock users out; requests will surface
  // the real gateway error instead.
  const models = available.length > 0 ? available : CATALOG.neon;
  cachedCatalog = { models, expires: Date.now() + (served ? CATALOG_TTL_MS : 30_000) };
  return models;
}

export async function resolveChatModel(requested?: string): Promise<{ model: LanguageModel; id: string }> {
  const provider = activeProvider();
  if (!provider) {
    throw new ModelConfigError(
      "No AI provider is configured. Add NEON_AI_GATEWAY_TOKEN and NEON_AI_GATEWAY_BASE_URL (or OPENAI_API_KEY) to .env.local.",
    );
  }
  const models = await listChatModels();
  const id = models.find((model) => model.id === requested)?.id ?? models[0].id;
  if (provider === "neon") return { model: createNeon()(id), id };
  return { model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id), id };
}

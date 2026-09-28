"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isStaticToolUIPart } from "ai";
import { Streamdown } from "streamdown";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  AiChat02Icon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp02Icon,
  Copy01Icon,
  Delete02Icon,
  RefreshIcon,
  StopIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { FinanceAgentUIMessage } from "@/lib/ai/agent";
import { ToolCall } from "@/components/chat/tool-call";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ChatSummary = { id: string; title: string; updatedAt: string };
type ChatModel = { id: string; label: string; vendor: string; description: string };

const MODEL_STORAGE_KEY = "my-cfo:chat-model";

const SUGGESTIONS = [
  "How much did I spend last month, and on what?",
  "Which categories grew the most compared with the month before?",
  "List my recurring payments and subscriptions.",
  "Who are my top 5 merchants this year?",
];

function readError(error: Error | undefined) {
  if (!error) return "";
  try {
    const body = JSON.parse(error.message) as { error?: string };
    if (body.error) return body.error;
  } catch {}
  return error.message || "Something went wrong. Try again.";
}

async function fetchChats() {
  const response = await fetch("/api/chats").catch(() => null);
  if (!response?.ok) return null;
  return ((await response.json()) as { chats: ChatSummary[] }).chats;
}

export function ChatWorkspace({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: FinanceAgentUIMessage[];
}) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [models, setModels] = useState<ChatModel[]>([]);
  const [model, setModel] = useState("");
  const router = useRouter();

  const loadChats = useCallback(() => {
    void fetchChats().then((list) => {
      if (list) setChats(list);
    });
  }, []);

  useEffect(() => {
    void fetchChats().then((list) => {
      if (list) setChats(list);
    });
    void fetch("/api/chat/models")
      .then((response) => response.json() as Promise<{ models: ChatModel[]; defaultModel: string | null }>)
      .then((body) => {
        setModels(body.models);
        const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
        const initial = body.models.find((option) => option.id === saved)?.id ?? body.defaultModel ?? "";
        setModel(initial);
      })
      .catch(() => undefined);
  }, []);

  function chooseModel(id: string) {
    setModel(id);
    window.localStorage.setItem(MODEL_STORAGE_KEY, id);
  }

  const transport = useMemo(
    () =>
      new DefaultChatTransport<FinanceAgentUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages, body }) => ({
          body: { id, message: messages[messages.length - 1], model: body?.model || undefined },
        }),
      }),
    [],
  );

  const { messages, sendMessage, regenerate, stop, status, error, clearError } = useChat<FinanceAgentUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      if (window.location.pathname !== `/chat/${chatId}`) {
        window.history.replaceState(null, "", `/chat/${chatId}`);
      }
      void loadChats();
    },
  });

  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    clearError();
    void sendMessage({ text: trimmed }, { body: { model } });
  }

  return (
    <div className="flex h-full min-h-0">
      <ChatHistory
        chats={chats}
        activeId={chatId}
        onDeleted={(id) => {
          setChats((current) => current.filter((chat) => chat.id !== id));
          if (id === chatId) router.push("/chat");
        }}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        <MessageList
          messages={messages}
          status={status}
          models={models}
          onSuggestion={submit}
          onRegenerate={() => {
            clearError();
            void regenerate({ body: { model } });
          }}
        />
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          {error ? (
            <div
              role="alert"
              className="mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.75} color="currentColor" />
              <span className="min-w-0 flex-1">{readError(error)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearError();
                  void regenerate({ body: { model } });
                }}
              >
                Retry
              </Button>
            </div>
          ) : null}
          <Composer
            busy={busy}
            models={models}
            model={model}
            onModel={chooseModel}
            onSubmit={submit}
            onStop={() => void stop()}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Answers use your booked transactions. Check important figures before acting on them.
          </p>
        </div>
      </section>
    </div>
  );
}

function ChatHistory({
  chats,
  activeId,
  onDeleted,
}: {
  chats: ChatSummary[];
  activeId: string;
  onDeleted: (id: string) => void;
}) {
  const [pending, setPending] = useState<ChatSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    const response = await fetch(`/api/chats/${pending.id}`, { method: "DELETE" });
    setDeleting(false);
    if (response.ok || response.status === 404) onDeleted(pending.id);
    setPending(null);
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 md:flex">
      <div className="p-3">
        <Button asChild variant="outline" className="w-full justify-start gap-2">
          <Link href="/chat">
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.75} color="currentColor" />
            New chat
          </Link>
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Previous chats">
        {chats.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">Your conversations will appear here.</p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center rounded-md ${chat.id === activeId ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              <Link
                href={`/chat/${chat.id}`}
                aria-current={chat.id === activeId ? "page" : undefined}
                className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm"
                title={chat.title}
              >
                {chat.title}
              </Link>
              <button
                type="button"
                aria-label={`Delete “${chat.title}”`}
                onClick={() => setPending(chat)}
                className="mr-1 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.75} color="currentColor" />
              </button>
            </div>
          ))
        )}
      </nav>
      <Dialog open={Boolean(pending)} onOpenChange={(open) => (!open && !deleting ? setPending(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>“{pending?.title}” and its messages will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function MessageList({
  messages,
  status,
  models,
  onSuggestion,
  onRegenerate,
}: {
  messages: FinanceAgentUIMessage[];
  status: string;
  models: ChatModel[];
  onSuggestion: (text: string) => void;
  onRegenerate: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (element && pinnedRef.current) element.scrollTop = element.scrollHeight;
  }, [messages]);

  function onScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    pinnedRef.current = nearBottom;
    setShowJump(!nearBottom);
  }

  function jumpToLatest() {
    const element = scrollRef.current;
    if (!element) return;
    pinnedRef.current = true;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }

  const last = messages[messages.length - 1];
  const waiting = status === "submitted" || (status === "streaming" && last?.role === "user");

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
          {messages.length === 0 ? (
            <EmptyState onSuggestion={onSuggestion} />
          ) : (
            messages.map((message, index) => (
              <Message
                key={message.id}
                message={message}
                models={models}
                streaming={status === "streaming" && index === messages.length - 1}
                canRegenerate={index === messages.length - 1 && message.role === "assistant" && status === "ready"}
                onRegenerate={onRegenerate}
              />
            ))
          )}
          {waiting ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <span className="flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current" />
              </span>
              Thinking…
            </div>
          ) : null}
        </div>
      </div>
      {showJump ? (
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Jump to latest message"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-sm"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={1.75} color="currentColor" />
        </Button>
      ) : null}
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon icon={AiChat02Icon} size={22} strokeWidth={1.75} color="currentColor" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Ask your CFO</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Get answers about your spending, income and cash flow, drawn directly from your bank statements.
      </p>
      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggestion(suggestion)}
            className="rounded-lg border bg-white px-4 py-3 text-left text-sm hover:bg-muted/60"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({
  message,
  models,
  streaming,
  canRegenerate,
  onRegenerate,
}: {
  message: FinanceAgentUIMessage;
  models: ChatModel[];
  streaming: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n\n");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }

  const modelLabel = models.find((option) => option.id === message.metadata?.model)?.label ?? message.metadata?.model;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group space-y-3">
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <Streamdown
              key={index}
              isAnimating={streaming}
              className="text-sm leading-relaxed [&_table]:text-xs"
            >
              {part.text}
            </Streamdown>
          );
        }
        if (part.type === "reasoning" && part.text.trim()) {
          return (
            <details key={index} className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Reasoning</summary>
              <p className="mt-1 whitespace-pre-wrap">{part.text}</p>
            </details>
          );
        }
        if (isStaticToolUIPart(part)) return <ToolCall key={part.toolCallId} part={part} />;
        return null;
      })}
      {!streaming && text ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Button variant="ghost" size="icon-sm" aria-label={copied ? "Copied" : "Copy answer"} onClick={() => void copy()}>
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={14} strokeWidth={1.75} color="currentColor" />
          </Button>
          {canRegenerate ? (
            <Button variant="ghost" size="icon-sm" aria-label="Regenerate answer" onClick={onRegenerate}>
              <HugeiconsIcon icon={RefreshIcon} size={14} strokeWidth={1.75} color="currentColor" />
            </Button>
          ) : null}
          {modelLabel ? (
            <span className="ml-1 opacity-0 transition-opacity group-hover:opacity-100">
              {modelLabel}
              {message.metadata?.totalTokens ? ` · ${message.metadata.totalTokens.toLocaleString()} tokens` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Composer({
  busy,
  models,
  model,
  onModel,
  onSubmit,
  onStop,
}: {
  busy: boolean;
  models: ChatModel[];
  model: string;
  onModel: (id: string) => void;
  onSubmit: (text: string) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selected = models.find((option) => option.id === model);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  }, [input]);

  function send() {
    if (!input.trim() || busy) return;
    onSubmit(input);
    setInput("");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="rounded-2xl border bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40"
    >
      <label htmlFor="chat-input" className="sr-only">
        Ask about your finances
      </label>
      <textarea
        id="chat-input"
        ref={textareaRef}
        value={input}
        rows={1}
        maxLength={4000}
        autoFocus
        placeholder="Ask about your spending, income, merchants…"
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        className="block max-h-[200px] w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        {models.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                {selected?.label ?? "Model"}
                <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={1.75} color="currentColor" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-60">
              <DropdownMenuLabel>Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {models.map((option) => (
                <DropdownMenuItem key={option.id} onSelect={() => onModel(option.id)} className="items-start">
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {option.vendor} · {option.description}
                    </span>
                  </span>
                  {option.id === model ? (
                    <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={1.75} color="currentColor" className="mt-0.5" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span />
        )}
        {busy ? (
          <Button type="button" size="icon-sm" variant="secondary" aria-label="Stop generating" onClick={onStop}>
            <HugeiconsIcon icon={StopIcon} size={16} strokeWidth={1.75} color="currentColor" />
          </Button>
        ) : (
          <Button type="submit" size="icon-sm" aria-label="Send message" disabled={!input.trim()}>
            <HugeiconsIcon icon={ArrowUp02Icon} size={16} strokeWidth={1.75} color="currentColor" />
          </Button>
        )}
      </div>
    </form>
  );
}

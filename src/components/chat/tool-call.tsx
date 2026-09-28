"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  Database01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import type { ToolUIPart } from "ai";

type Loose = Record<string, unknown>;

const TOOL_LABELS: Record<string, { running: string; done: string }> = {
  getDataCoverage: { running: "Checking what data is available", done: "Checked data coverage" },
  getFinancialSummary: { running: "Totalling income and spending", done: "Totalled income and spending" },
  getSpendingByCategory: { running: "Breaking down by category", done: "Broke down by category" },
  getMonthlyTrend: { running: "Charting the monthly trend", done: "Charted the monthly trend" },
  searchTransactions: { running: "Searching transactions", done: "Searched transactions" },
  getTopMerchants: { running: "Ranking merchants", done: "Ranked merchants" },
  comparePeriods: { running: "Comparing periods", done: "Compared periods" },
  listStatements: { running: "Listing statements", done: "Listed statements" },
  findRecurringPayments: { running: "Looking for recurring payments", done: "Found recurring payments" },
};

function toolName(part: ToolUIPart) {
  return part.type.replace(/^tool-/, "");
}

function describeInput(input: Loose | undefined) {
  if (!input) return "";
  const bits: string[] = [];
  if (typeof input.from === "string" && typeof input.to === "string") bits.push(`${input.from} → ${input.to}`);
  const current = input.current as Loose | undefined;
  const previous = input.previous as Loose | undefined;
  if (current && previous) bits.push(`${current.from}–${current.to} vs ${previous.from}–${previous.to}`);
  if (typeof input.category === "string") bits.push(input.category);
  if (Array.isArray(input.categories) && input.categories.length) bits.push(input.categories.join(", "));
  if (typeof input.text === "string") bits.push(`“${input.text}”`);
  if (typeof input.bank === "string") bits.push(input.bank.toUpperCase());
  if (input.includeDrafts === true) bits.push("incl. drafts");
  return bits.join(" · ");
}

function describeOutput(name: string, output: Loose | undefined) {
  if (!output) return "";
  const count = (key: string) => (Array.isArray(output[key]) ? (output[key] as unknown[]).length : 0);
  switch (name) {
    case "searchTransactions":
      return `${output.matched} ${output.matched === 1 ? "match" : "matches"}`;
    case "getSpendingByCategory":
    case "comparePeriods":
      return `${count("categories")} categories`;
    case "getMonthlyTrend":
      return `${count("months")} months`;
    case "getTopMerchants":
      return `${count("merchants")} merchants`;
    case "listStatements":
      return `${count("statements")} statements`;
    case "findRecurringPayments":
      return `${count("recurring")} found`;
    case "getFinancialSummary":
      return `${output.transactionCount} transactions`;
    case "getDataCoverage":
      return output.earliestDate ? `${output.earliestDate} → ${output.latestDate}` : "no data yet";
    default:
      return "";
  }
}

export function ToolCall({ part }: { part: ToolUIPart }) {
  const [open, setOpen] = useState(false);
  const name = toolName(part);
  const labels = TOOL_LABELS[name] ?? { running: `Running ${name}`, done: `Ran ${name}` };
  const input = part.input as Loose | undefined;
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error" || part.state === "output-denied";
  const detail = [
    describeInput(input),
    part.state === "output-available" ? describeOutput(name, part.output as Loose) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border bg-muted/30 text-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <HugeiconsIcon
          icon={running ? Loading03Icon : failed ? Alert02Icon : CheckmarkCircle02Icon}
          size={14}
          strokeWidth={1.75}
          color="currentColor"
          className={`shrink-0 ${running ? "animate-spin text-muted-foreground" : failed ? "text-destructive" : "text-primary"}`}
        />
        <HugeiconsIcon icon={Database01Icon} size={14} strokeWidth={1.75} color="currentColor" className="shrink-0 text-muted-foreground" />
        <span className="font-medium">{running ? `${labels.running}…` : failed ? `${labels.running} failed` : labels.done}</span>
        {detail ? <span className="truncate text-muted-foreground">{detail}</span> : null}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          strokeWidth={1.75}
          color="currentColor"
          className={`ml-auto shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="space-y-2 border-t px-3 py-2">
          {part.state === "output-error" ? <p className="text-destructive">{part.errorText}</p> : null}
          <ToolJson label="Input" value={part.input} />
          {part.state === "output-available" ? <ToolJson label="Result" value={part.output} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolJson({ label, value }: { label: string; value: unknown }) {
  if (value === undefined) return null;
  return (
    <div>
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-md bg-background p-2 font-mono text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

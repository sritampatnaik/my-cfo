"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TRANSACTION_KINDS } from "@/lib/banks";
import type { Summary } from "@/lib/finance";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const KIND_COLORS: Record<string, string> = {
  Income: "#047857",
  Transfer: "#0369a1",
  Groceries: "#4d7c0f",
  Dining: "#c2410c",
  Transport: "#1d4ed8",
  Housing: "#6d28d9",
  Utilities: "#b45309",
  Shopping: "#be185d",
  Healthcare: "#be123c",
  Fees: "#4338ca",
  Cash: "#0f766e",
  Other: "#52525b",
  Unclassified: "#78716c",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });
const compact = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function monthKeys(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  if (!fromYear || !fromMonth || !toYear || !toMonth) return [];
  const keys: string[] = [];
  let year = fromYear;
  let month = fromMonth;
  while ((year < toYear || (year === toYear && month <= toMonth)) && keys.length < 36) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

function monthName(key: string, withYear: "short" | "full") {
  const [year, month] = key.split("-").map(Number);
  const name = MONTHS[(month ?? 1) - 1] ?? key;
  if (withYear === "short") return `${name} ${String(year).slice(2)}`;
  return `${name} ${year}`;
}

export function TypeChart({
  from,
  to,
  months,
}: {
  from: string;
  to: string;
  months: Summary["months"];
}) {
  const totals = new Map(months.map((entry) => [entry.month, entry.kinds]));
  const present = new Set(months.flatMap((entry) => entry.kinds.map((kind) => kind.kind)));
  const kinds = [...TRANSACTION_KINDS, "Unclassified"].filter((kind) => present.has(kind));
  const rows = monthKeys(from, to).map((month) => {
    const row: Record<string, string | number | null> = { month };
    const amounts = new Map((totals.get(month) ?? []).map((kind) => [kind.kind, kind.total]));
    for (const kind of kinds) {
      const signed = amounts.get(kind) ?? 0;
      row[kind] = signed === 0 ? null : Math.abs(signed);
      row[`${kind}Amount`] = signed;
    }
    return row;
  });
  const config = Object.fromEntries(
    kinds.map((kind) => [kind, { label: kind, color: KIND_COLORS[kind] ?? "#52525b" }]),
  ) satisfies ChartConfig;

  if (kinds.length === 0) return null;

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={rows} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          tickFormatter={(value) => monthName(String(value), "short")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(value) => compact.format(Number(value))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => monthName(String(value), "full")}
              formatter={(value, name, item) => {
                const signed = Number(item.payload?.[`${String(name)}Amount`] ?? value);
                if (!signed) return null;
                return (
                  <>
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ background: item.color }}
                    />
                    <div className="flex flex-1 items-center justify-between gap-4">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {money.format(signed)}
                      </span>
                    </div>
                  </>
                );
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
        {kinds.map((kind) => (
          <Bar key={kind} dataKey={kind} stackId="type" fill={`var(--color-${kind})`} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatMoney,
  ledgerSeed,
  ledgerViews,
  matchesQuery,
  matchesView,
  type LedgerRow,
  type LedgerView,
} from "@/lib/ledger";
import { cn } from "cn";

const LedgerGrid = dynamic(
  () => import("@/components/ledger-grid").then((mod) => mod.LedgerGrid),
  {
    ssr: false,
    loading: () => <div className="min-h-0 flex-1 bg-background" />,
  },
);

export function LedgerSheet() {
  const [rows, setRows] = useState<LedgerRow[]>(ledgerSeed);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LedgerView>("all");

  const visibleRows = useMemo(
    () => rows.filter((row) => matchesView(row, view) && matchesQuery(row, query)),
    [rows, query, view],
  );

  const totals = useMemo(() => {
    return visibleRows.reduce(
      (sum, row) => {
        if (row.amount > 0) sum.inflows += row.amount;
        if (row.amount < 0) sum.outflows += row.amount;
        sum.net += row.amount;
        return sum;
      },
      { inflows: 0, outflows: 0, net: 0 },
    );
  }, [visibleRows]);

  const viewLabel = ledgerViews.find((item) => item.value === view)?.label ?? "All activity";

  function onEdit(id: string, patch: Partial<LedgerRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ledger
          </p>
          <h1 className="truncate text-base font-semibold">September activity</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{visibleRows.length} rows</Badge>
          <Tooltip>
            <TooltipTrigger
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              How to edit
            </TooltipTrigger>
            <TooltipContent>
              Click a vendor, amount, owner, or note cell and type. Category and status are labels.
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vendor, category, owner, note"
            className="pl-8"
            aria-label="Search ledger"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            {viewLabel}
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={view}
              onValueChange={(value) => setView(value as LedgerView)}
            >
              {ledgerViews.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value}>
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-3 border-b">
        <Total label="Inflows" value={formatMoney(totals.inflows)} />
        <Total label="Outflows" value={formatMoney(totals.outflows)} />
        <Total label="Net" value={formatMoney(totals.net)} />
      </div>

      <div className="relative min-h-0 flex-1">
        {visibleRows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium">No matching rows</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search, or switch the view back to all activity.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setView("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <LedgerGrid rows={visibleRows} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 not-last:border-r">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}

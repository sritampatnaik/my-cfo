"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BANKS, findBank } from "@/lib/banks";
import type { Summary, TransactionRow } from "@/lib/finance";
import { BankLogo } from "@/components/bank-logo";
import { KindPill } from "@/components/kind-pill";
import { StatementTable, TransactionTableView, type StatementRow } from "@/components/finance-tables";
import { DateField, MonthField } from "@/components/date-field";
import { TypeChart } from "@/components/type-chart";
import { UploadDialog } from "@/components/upload-dialog";
import { Button } from "@/components/ui/button";

type FinancePayload = {
  from: string;
  to: string;
  summary: Summary;
  transactions: TransactionRow[];
};

const money = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
});

function localDate(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function formatMoney(amount: number, currency = "SGD") {
  if (currency === "SGD") return money.format(amount);
  return new Intl.NumberFormat("en-SG", { style: "currency", currency }).format(amount);
}

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function useLedger() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useMemo(() => localDate(), []);
  const defaultFrom = useMemo(() => {
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    return localDate(start);
  }, []);
  const from = validDate(searchParams.get("from")) ?? defaultFrom;
  const to = validDate(searchParams.get("to")) ?? today;
  const [data, setData] = useState<FinancePayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(`/api/finance?from=${from}&to=${to}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as FinancePayload & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load transactions.");
        if (!active) return;
        setData(body);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Could not load transactions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [from, to, revision]);

  function replaceRange(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function refresh() {
    setLoading(true);
    setRevision((current) => current + 1);
  }

  function changeFrom(value: string) {
    setLoading(true);
    replaceRange(value, to);
  }

  function changeTo(value: string) {
    setLoading(true);
    replaceRange(from, value);
  }

  function replaceKind(id: string, kind: string | null) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        transactions: current.transactions.map((row) => (row.id === id ? { ...row, kind } : row)),
      };
    });
  }

  return { from, to, data, loadError, loading, refresh, changeFrom, changeTo, replaceKind };
}

export function DashboardPage() {
  const ledger = useLedger();
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Dashboard
        from={ledger.from}
        to={ledger.to}
        onFrom={ledger.changeFrom}
        onTo={ledger.changeTo}
        data={ledger.data}
        loading={ledger.loading}
        error={ledger.loadError}
      />
    </div>
  );
}

export function UploadPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Upload statements</h1>
      <UploadTab />
    </div>
  );
}

export function TransactionsPage() {
  const ledger = useLedger();
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Transactions</h1>
      <TransactionTable
        from={ledger.from}
        to={ledger.to}
        onFrom={ledger.changeFrom}
        onTo={ledger.changeTo}
        rows={ledger.data?.transactions ?? []}
        loading={ledger.loading}
        error={ledger.loadError}
        onRefresh={ledger.refresh}
        onKindChange={ledger.replaceKind}
      />
    </div>
  );
}

function Dashboard({
  from,
  to,
  onFrom,
  onTo,
  data,
  loading,
  error,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  data: FinancePayload | null;
  loading: boolean;
  error: string;
}) {
  const summary = data?.summary;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">From</span>
          <DateField label="From" value={from} max={to} onChange={onFrom} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">To</span>
          <DateField label="To" value={to} min={from} onChange={onTo} />
        </label>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Inflows" value={loading ? "…" : formatMoney(summary?.inflows ?? 0)} />
        <Stat label="Outflows" value={loading ? "…" : formatMoney(summary?.outflows ?? 0)} />
        <Stat label="Net" value={loading ? "…" : formatMoney(summary?.net ?? 0)} />
        <Stat label="Transactions" value={loading ? "…" : String(summary?.count ?? 0)} />
      </div>
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3 text-sm font-medium">By month</div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : summary && summary.months.length > 0 ? (
          <div className="px-2 py-4">
            <TypeChart from={from} to={to} months={summary.months} />
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Upload a statement to see spending by type.
          </p>
        )}
      </div>
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3 text-sm font-medium">By type</div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : summary && summary.kinds.length > 0 ? (
          <ul>
            {summary.kinds.map((kind) => (
              <li key={kind.kind} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0">
                <span className="flex items-center gap-2">
                  <KindPill kind={kind.kind} />
                  <span className="text-muted-foreground">{kind.count}</span>
                </span>
                <span className="font-mono tabular-nums">{formatMoney(kind.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Upload a statement to see spending by type.
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg tabular-nums">{value}</p>
    </div>
  );
}

type StatementRecord = {
  id: string;
  filename: string;
  bank: string | null;
  status: string;
  periodYear: number | null;
  periodMonth: number | null;
  uploadedAt: string;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Stored",
  processing: "Reading",
  detected: "Detected",
  extracted: "Extracted",
  ready: "Categorised",
  error: "Error",
};

function periodLabel(year: number | null, month: number | null) {
  if (!year || !month) return "—";
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

function monthValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function UploadTab() {
  const openIdRef = useRef("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [openId, setOpenId] = useState("");
  const [bankId, setBankId] = useState("");
  const [period, setPeriod] = useState("");
  const [processing, setProcessing] = useState<string[]>([]);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<StatementRecord[]>([]);
  const selected = findBank(bankId);
  const openStatement = history.find((row) => row.id === openId);
  const reading = Boolean(openId && processing.includes(openId));

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    const response = await fetch("/api/statements");
    const body = (await response.json()) as { statements?: StatementRecord[] };
    if (response.ok) setHistory(body.statements ?? []);
  }

  async function loadRows(id: string) {
    const response = await fetch(`/api/statements/${id}/transactions`);
    const body = (await response.json()) as { transactions?: TransactionRow[]; error?: string };
    if (!response.ok) throw new Error(body.error || "Could not load those transactions.");
    if (openIdRef.current === id) setRows(body.transactions ?? []);
  }

  function markProcessing(id: string, active: boolean) {
    setProcessing((current) =>
      active ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );
  }

  async function analyze(id: string) {
    markProcessing(id, true);
    const response = await fetch(`/api/statements/${id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = (await response.json()) as { year?: number; month?: number; error?: string };
    markProcessing(id, false);
    if (!response.ok) {
      setError(body.error || "Could not read that statement.");
      await loadHistory();
      return;
    }
    if (openIdRef.current === id && body.year && body.month) {
      setPeriod(monthValue(body.year, body.month));
      try {
        await loadRows(id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load those transactions.");
      }
    }
    await loadHistory();
  }

  async function uploadMany(files: File[]) {
    setError("");
    for (const file of files) {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/statements", { method: "POST", body: form });
      const body = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !body.id) {
        setError(body.error || `Could not upload ${file.name}.`);
        continue;
      }
      await loadHistory();
      void analyze(body.id);
    }
  }

  function openDocument(id: string) {
    const record = history.find((row) => row.id === id);
    openIdRef.current = id;
    setOpenId(id);
    setBankId(record?.bank ?? "");
    setPeriod(record?.periodYear && record.periodMonth ? monthValue(record.periodYear, record.periodMonth) : "");
    setRows([]);
    setMessage("");
    setError("");
    if (record && !processing.includes(id) && record.status !== "uploaded") {
      void loadRows(id).catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Could not load those transactions.");
      });
    }
  }

  function closeDocument() {
    openIdRef.current = "";
    setOpenId("");
    setRows([]);
    setMessage("");
    setError("");
  }

  async function saveBank(nextBank: string) {
    if (!openId) return;
    setBankId(nextBank);
    setError("");
    const response = await fetch(`/api/statements/${openId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank: nextBank }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error || "Could not save the bank.");
      return;
    }
    await loadHistory();
  }

  async function savePeriod(value: string) {
    if (!openId || !value) return;
    setPeriod(value);
    const [year, month] = value.split("-").map(Number);
    const response = await fetch(`/api/statements/${openId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    const saved = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(saved.error || "Could not save the statement period.");
      return;
    }
    await loadHistory();
  }

  async function changeKind(id: string, kind: string) {
    const previous = rows.find((row) => row.id === id)?.kind ?? null;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, kind } : row)));
    setError("");
    const response = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setRows((current) => current.map((row) => (row.id === id ? { ...row, kind: previous } : row)));
      setError(body.error || "Could not update that type.");
    }
  }

  async function categorise() {
    if (!openId) return;
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/transactions/categorise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statementId: openId }),
    });
    const body = (await response.json()) as { count?: number; error?: string };
    if (!response.ok) {
      setBusy(false);
      setError(body.error || "Jev could not categorise these transactions.");
      return;
    }
    await loadRows(openId);
    setBusy(false);
    setMessage(
      body.count
        ? `Jev typed ${body.count} transactions.`
        : "Every transaction already has a type.",
    );
    await loadHistory();
  }

  const historyRows: StatementRow[] = history.map((row) => ({
    id: row.id,
    filename: row.filename,
    bank: row.bank,
    period: periodLabel(row.periodYear, row.periodMonth),
    uploaded: row.uploadedAt.slice(0, 10),
    status: processing.includes(row.id) ? "Reading" : (STATUS_LABEL[row.status] ?? row.status),
  }));

  return (
    <section className="space-y-5">
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        existingNames={history.map((row) => row.filename)}
        onProcess={(files) => void uploadMany(files)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {openId ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Button variant="outline" size="sm" onClick={closeDocument}>
                Back
              </Button>
              <h2 className="text-lg font-medium">{openStatement?.filename ?? "Statement"}</h2>
            </div>
            <Button disabled={busy || reading || rows.length === 0} onClick={() => void categorise()}>
              {busy ? "Categorising…" : "Categorise"}
            </Button>
          </div>
          {message ? <p className="text-sm">{message}</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BANKS.map((bank) => (
              <button
                key={bank.id}
                type="button"
                onClick={() => void saveBank(bank.id)}
                className={`flex items-center gap-3 rounded-lg border bg-white p-3 text-left ${bankId === bank.id ? "border-foreground" : "border-border"}`}
              >
                <BankLogo bank={bank} />
                <span className="text-sm font-medium">{bank.name}</span>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
              <BankLogo bank={selected} className="h-10 w-auto" />
              <p className="text-sm font-medium">{selected.name}</p>
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Statement month</span>
            <MonthField
              label="Statement month"
              value={period}
              disabled={reading && !period}
              onChange={(value) => void savePeriod(value)}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            {reading
              ? "Reading the statement…"
              : `${rows.length} transactions extracted.`}
          </p>
          <StatementRows rows={rows} onKindChange={(id, kind) => void changeKind(id, kind)} />
        </div>
      ) : (
        <div className="space-y-5">
          <Button onClick={() => setUploadOpen(true)}>Upload e-statements</Button>
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Previous uploads</h2>
            <StatementTable rows={historyRows} onOpen={openDocument} />
          </div>
        </div>
      )}
    </section>
  );
}

function StatementRows({
  rows,
  onKindChange,
}: {
  rows: TransactionRow[];
  onKindChange: (id: string, kind: string) => void;
}) {
  return (
    <TransactionTableView
      rows={rows}
      empty="No transactions were found in that statement."
      onKindChange={onKindChange}
    />
  );
}

function TransactionTable({
  from,
  to,
  onFrom,
  onTo,
  rows,
  loading,
  error,
  onRefresh,
  onKindChange,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  rows: TransactionRow[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onKindChange: (id: string, kind: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [kindError, setKindError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function changeKind(id: string, kind: string) {
    const previous = rows.find((row) => row.id === id)?.kind ?? null;
    setKindError("");
    setSavingId(id);
    onKindChange(id, kind);
    const response = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const body = (await response.json()) as { error?: string };
    setSavingId(null);
    if (!response.ok) {
      onKindChange(id, previous);
      setKindError(body.error || "Could not update that type.");
    }
  }

  async function categorise() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/transactions/categorise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    const body = (await response.json()) as { count?: number; error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Jev could not categorise these transactions.");
      return;
    }
    setMessage(
      body.count
        ? `Jev typed ${body.count} transactions.`
        : "Every transaction in this range already has a type.",
    );
    onRefresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <DateField label="From" value={from} max={to} onChange={onFrom} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">To</span>
            <DateField label="To" value={to} min={from} onChange={onTo} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{rows.length} in this date range</p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          <Button size="sm" disabled={busy || rows.length === 0} onClick={() => void categorise()}>
            {busy ? "Categorising…" : "Categorise"}
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {kindError ? <p className="text-sm text-destructive">{kindError}</p> : null}
      {message ? <p className="text-sm">{message}</p> : null}
      {rows.length === 0 && loading ? (
        <p className="rounded-lg border px-3 py-8 text-center text-sm text-muted-foreground">
          Loading transactions…
        </p>
      ) : (
        <TransactionTableView rows={rows} savingId={savingId} onKindChange={(id, kind) => void changeKind(id, kind)} />
      )}
    </section>
  );
}

import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { findBank } from "@/lib/banks";
import type { TransactionRow } from "@/lib/finance";
import { BankLogo } from "@/components/bank-logo";
import { KindPicker } from "@/components/kind-pill";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

function formatMoney(amount: number, currency = "SGD") {
  if (currency === "SGD") return money.format(amount);
  return new Intl.NumberFormat("en-SG", { style: "currency", currency }).format(amount);
}

export type StatementRow = {
  id: string;
  filename: string;
  bank: string | null;
  period: string;
  uploaded: string;
  status: string;
};

function MonthTag({ label }: { label: string }) {
  if (!label || label === "—") return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <HugeiconsIcon icon={Calendar03Icon} size={14} strokeWidth={1.75} color="currentColor" />
      {label}
    </span>
  );
}

function BankMark({ bankId }: { bankId: string | null }) {
  const bank = bankId ? findBank(bankId) : undefined;
  if (!bank) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <BankLogo bank={bank} className="h-6 w-auto" />
      <span>{bank.name}</span>
    </span>
  );
}

export function TransactionTableView({
  rows,
  empty = "No transactions in this range yet.",
  onKindChange,
  savingId = null,
}: {
  rows: TransactionRow[];
  empty?: string;
  onKindChange?: (id: string, kind: string) => void;
  savingId?: string | null;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.postedOn}</TableCell>
                <TableCell className="whitespace-normal">{row.description}</TableCell>
                <TableCell>
                  <BankMark bankId={row.bank} />
                </TableCell>
                <TableCell>
                  <KindPicker
                    kind={row.kind}
                    disabled={savingId === row.id}
                    onChange={(kind) => onKindChange?.(row.id, kind)}
                  />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(row.amount, row.currency)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function StatementTable({
  rows,
  empty = "No statements uploaded yet.",
  onOpen,
}: {
  rows: StatementRow[];
  empty?: string;
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead>Month</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={onOpen ? "cursor-pointer" : undefined}
                tabIndex={onOpen ? 0 : undefined}
                onClick={onOpen ? () => onOpen(row.id) : undefined}
                onKeyDown={
                  onOpen
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpen(row.id);
                        }
                      }
                    : undefined
                }
              >
                <TableCell className="whitespace-normal">{row.filename}</TableCell>
                <TableCell>
                  <BankMark bankId={row.bank} />
                </TableCell>
                <TableCell>
                  <MonthTag label={row.period} />
                </TableCell>
                <TableCell>{row.uploaded}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.status}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

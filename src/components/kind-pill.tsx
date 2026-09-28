"use client";

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { TRANSACTION_KINDS } from "@/lib/banks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDataTransferHorizontalIcon,
  Car01Icon,
  Cash01Icon,
  ElectricPlugsIcon,
  HelpCircleIcon,
  Home01Icon,
  Hospital01Icon,
  Invoice01Icon,
  MoneyReceive01Icon,
  MoreHorizontalIcon,
  Restaurant01Icon,
  ShoppingBag01Icon,
  ShoppingBasket01Icon,
} from "@hugeicons/core-free-icons";

type KindStyle = {
  icon: IconSvgElement;
  className: string;
};

const KIND_STYLES: Record<string, KindStyle> = {
  Income: {
    icon: MoneyReceive01Icon,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  Transfer: {
    icon: ArrowDataTransferHorizontalIcon,
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  Groceries: {
    icon: ShoppingBasket01Icon,
    className: "border-lime-200 bg-lime-50 text-lime-900",
  },
  Dining: {
    icon: Restaurant01Icon,
    className: "border-orange-200 bg-orange-50 text-orange-800",
  },
  Transport: {
    icon: Car01Icon,
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  Housing: {
    icon: Home01Icon,
    className: "border-violet-200 bg-violet-50 text-violet-800",
  },
  Utilities: {
    icon: ElectricPlugsIcon,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  Shopping: {
    icon: ShoppingBag01Icon,
    className: "border-pink-200 bg-pink-50 text-pink-800",
  },
  Healthcare: {
    icon: Hospital01Icon,
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
  Fees: {
    icon: Invoice01Icon,
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  Cash: {
    icon: Cash01Icon,
    className: "border-teal-200 bg-teal-50 text-teal-800",
  },
  Other: {
    icon: MoreHorizontalIcon,
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
  },
  Unclassified: {
    icon: HelpCircleIcon,
    className: "border-stone-200 bg-stone-50 text-stone-600",
  },
};

const FALLBACK = KIND_STYLES.Other;

export function KindPill({ kind }: { kind: string }) {
  const style = KIND_STYLES[kind] ?? FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${style.className}`}
    >
      <HugeiconsIcon icon={style.icon} size={14} strokeWidth={1.75} color="currentColor" />
      {kind}
    </span>
  );
}

export function KindPicker({
  kind,
  disabled = false,
  onChange,
}: {
  kind: string | null;
  disabled?: boolean;
  onChange: (kind: string) => void;
}) {
  const label = kind || "Unclassified";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Change type, currently ${label}`}
          className="cursor-pointer rounded-full outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
        >
          <KindPill kind={label} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {TRANSACTION_KINDS.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => onChange(option)}
          >
            <KindPill kind={option} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

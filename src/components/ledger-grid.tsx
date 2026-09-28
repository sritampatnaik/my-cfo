"use client";

import "@glideapps/glide-data-grid/dist/index.css";
import DataEditor, {
  GridCellKind,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type Item,
  type Theme,
} from "@glideapps/glide-data-grid";
import {
  formatMoney,
  type LedgerRow,
  type LedgerStatus,
} from "@/lib/ledger";

const columns: GridColumn[] = [
  { title: "Vendor", id: "vendor", width: 220 },
  { title: "Category", id: "category", width: 140 },
  { title: "Amount", id: "amount", width: 140 },
  { title: "Status", id: "status", width: 120 },
  { title: "Owner", id: "owner", width: 140 },
  { title: "Note", id: "note", width: 320, grow: 1 },
];

const gridTheme: Partial<Theme> = {
  accentColor: "oklch(0.922 0 0)",
  accentFg: "oklch(0.205 0 0)",
  accentLight: "oklch(0.269 0 0)",
  textDark: "oklch(0.985 0 0)",
  textMedium: "oklch(0.708 0 0)",
  textLight: "oklch(0.556 0 0)",
  textBubble: "oklch(0.985 0 0)",
  bgIconHeader: "oklch(0.708 0 0)",
  fgIconHeader: "oklch(0.145 0 0)",
  textHeader: "oklch(0.708 0 0)",
  textHeaderSelected: "oklch(0.985 0 0)",
  bgCell: "oklch(0.145 0 0)",
  bgCellMedium: "oklch(0.205 0 0)",
  bgHeader: "oklch(0.205 0 0)",
  bgHeaderHasFocus: "oklch(0.269 0 0)",
  bgHeaderHovered: "oklch(0.269 0 0)",
  bgBubble: "oklch(0.269 0 0)",
  bgBubbleSelected: "oklch(0.371 0 0)",
  bgSearchResult: "oklch(0.371 0 0)",
  borderColor: "oklch(1 0 0 / 10%)",
  horizontalBorderColor: "oklch(1 0 0 / 8%)",
  drilldownBorder: "oklch(1 0 0 / 16%)",
  linkColor: "oklch(0.922 0 0)",
  headerFontStyle: "600 12px",
  baseFontStyle: "13px",
  fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif",
  editorFontSize: "13px",
};

const statusTheme: Record<LedgerStatus, Partial<Theme>> = {
  Paid: {
    bgBubble: "oklch(0.32 0.05 155)",
    textBubble: "oklch(0.9 0.04 155)",
  },
  Pending: {
    bgBubble: "oklch(0.35 0.05 75)",
    textBubble: "oklch(0.92 0.05 85)",
  },
  Review: {
    bgBubble: "oklch(0.32 0.03 25)",
    textBubble: "oklch(0.9 0.04 25)",
  },
};

function textCell(value: string): GridCell {
  return {
    kind: GridCellKind.Text,
    data: value,
    displayData: value,
    allowOverlay: true,
    copyData: value,
  };
}

function bubbleCell(value: string, themeOverride?: Partial<Theme>): GridCell {
  return {
    kind: GridCellKind.Bubble,
    data: [value],
    allowOverlay: false,
    copyData: value,
    themeOverride,
  };
}

type LedgerGridProps = {
  rows: LedgerRow[];
  onEdit: (id: string, patch: Partial<LedgerRow>) => void;
};

export function LedgerGrid({ rows, onEdit }: LedgerGridProps) {
  function getCellContent([col, rowIndex]: Item): GridCell {
    const row = rows[rowIndex];
    if (!row) {
      return textCell("");
    }

    switch (col) {
      case 0:
        return textCell(row.vendor);
      case 1:
        return bubbleCell(row.category);
      case 2:
        return {
          kind: GridCellKind.Number,
          data: row.amount,
          displayData: formatMoney(row.amount),
          allowOverlay: true,
          allowNegative: true,
          contentAlign: "right",
          copyData: String(row.amount),
        };
      case 3:
        return bubbleCell(row.status, statusTheme[row.status]);
      case 4:
        return textCell(row.owner);
      default:
        return textCell(row.note);
    }
  }

  function onCellEdited([col, rowIndex]: Item, newValue: EditableGridCell) {
    const row = rows[rowIndex];
    if (!row) return;

    if (col === 0 && newValue.kind === GridCellKind.Text) {
      onEdit(row.id, { vendor: newValue.data });
    } else if (col === 2 && newValue.kind === GridCellKind.Number) {
      onEdit(row.id, { amount: newValue.data ?? 0 });
    } else if (col === 4 && newValue.kind === GridCellKind.Text) {
      onEdit(row.id, { owner: newValue.data });
    } else if (col === 5 && newValue.kind === GridCellKind.Text) {
      onEdit(row.id, { note: newValue.data });
    }
  }

  return (
    <DataEditor
      columns={columns}
      rows={rows.length}
      getCellContent={getCellContent}
      onCellEdited={onCellEdited}
      theme={gridTheme}
      rowMarkers="number"
      freezeColumns={1}
      getCellsForSelection
      smoothScrollX
      smoothScrollY
      rowHeight={36}
      headerHeight={36}
      width="100%"
      height="100%"
    />
  );
}

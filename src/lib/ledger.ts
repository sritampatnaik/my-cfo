export type LedgerStatus = "Paid" | "Pending" | "Review";

export type LedgerView = "all" | "inflows" | "outflows";

export type LedgerRow = {
  id: string;
  vendor: string;
  category: string;
  amount: number;
  status: LedgerStatus;
  owner: string;
  note: string;
};

export const ledgerViews: { value: LedgerView; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "inflows", label: "Inflows" },
  { value: "outflows", label: "Outflows" },
];

export const ledgerSeed: LedgerRow[] = [
  {
    id: "txn-1",
    vendor: "Northline Retainers",
    category: "Revenue",
    amount: 64000,
    status: "Paid",
    owner: "Finance",
    note: "September advisory retainers",
  },
  {
    id: "txn-2",
    vendor: "Harbor Payroll",
    category: "Payroll",
    amount: -48200,
    status: "Paid",
    owner: "People",
    note: "September payroll run",
  },
  {
    id: "txn-3",
    vendor: "Atlas Cloud",
    category: "Software",
    amount: -1860,
    status: "Paid",
    owner: "Engineering",
    note: "Production hosting",
  },
  {
    id: "txn-4",
    vendor: "Cedar Workspace",
    category: "Rent",
    amount: -9200,
    status: "Pending",
    owner: "Ops",
    note: "October office rent",
  },
  {
    id: "txn-5",
    vendor: "Fieldnote Travel",
    category: "Travel",
    amount: -2140,
    status: "Review",
    owner: "Ops",
    note: "Client onsite, awaiting receipts",
  },
  {
    id: "txn-6",
    vendor: "Lumen Insurance",
    category: "Insurance",
    amount: -760,
    status: "Paid",
    owner: "Finance",
    note: "Monthly liability premium",
  },
  {
    id: "txn-7",
    vendor: "Brightpath Studios",
    category: "Revenue",
    amount: 18500,
    status: "Pending",
    owner: "Finance",
    note: "Implementation invoice, net 15",
  },
  {
    id: "txn-8",
    vendor: "Paperlane Legal",
    category: "Professional",
    amount: -3400,
    status: "Review",
    owner: "Finance",
    note: "Contract review",
  },
  {
    id: "txn-9",
    vendor: "Kiln Analytics",
    category: "Software",
    amount: -420,
    status: "Paid",
    owner: "Engineering",
    note: "Product analytics seat",
  },
  {
    id: "txn-10",
    vendor: "Sable Marketing",
    category: "Marketing",
    amount: -6100,
    status: "Pending",
    owner: "Growth",
    note: "Campaign production",
  },
  {
    id: "txn-11",
    vendor: "Orchard Benefits",
    category: "Payroll",
    amount: -8740,
    status: "Paid",
    owner: "People",
    note: "Health benefits",
  },
  {
    id: "txn-12",
    vendor: "Westbridge Capital",
    category: "Revenue",
    amount: 25000,
    status: "Paid",
    owner: "Finance",
    note: "Quarterly success fee",
  },
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatMoney(amount: number) {
  return money.format(amount);
}

export function matchesView(row: LedgerRow, view: LedgerView) {
  if (view === "inflows") return row.amount > 0;
  if (view === "outflows") return row.amount < 0;
  return true;
}

export function matchesQuery(row: LedgerRow, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.vendor, row.category, row.status, row.owner, row.note, formatMoney(row.amount)]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

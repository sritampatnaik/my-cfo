export const TRANSACTION_KINDS = [
  "Income",
  "Transfer",
  "Groceries",
  "Dining",
  "Transport",
  "Housing",
  "Utilities",
  "Shopping",
  "Healthcare",
  "Fees",
  "Cash",
  "Other",
] as const;

export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export type Bank = {
  id: string;
  name: string;
  color: string;
  ink: string;
};

export const BANKS: Bank[] = [
  { id: "dbs", name: "DBS", color: "#E30613", ink: "#ffffff" },
  { id: "posb", name: "POSB", color: "#C8102E", ink: "#ffffff" },
  { id: "ocbc", name: "OCBC", color: "#E31837", ink: "#ffffff" },
  { id: "uob", name: "UOB", color: "#0B3D91", ink: "#ffffff" },
  { id: "hsbc", name: "HSBC", color: "#DB0011", ink: "#ffffff" },
  { id: "sc", name: "Standard Chartered", color: "#0072AA", ink: "#ffffff" },
  { id: "citi", name: "Citi", color: "#003B70", ink: "#ffffff" },
  { id: "maybank", name: "Maybank", color: "#FFC20E", ink: "#1a1a1a" },
];

export function findBank(id: string) {
  return BANKS.find((bank) => bank.id === id);
}

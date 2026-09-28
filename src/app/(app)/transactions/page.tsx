import { Suspense } from "react";
import { TransactionsPage } from "@/components/finance-app";

export const metadata = {
  title: "Transactions · my-cfo",
};

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading transactions…</p>}>
      <TransactionsPage />
    </Suspense>
  );
}

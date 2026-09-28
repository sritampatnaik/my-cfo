import { Suspense } from "react";
import { DashboardPage } from "@/components/finance-app";

export const metadata = {
  title: "Dashboard · my-cfo",
};

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading dashboard…</p>}>
      <DashboardPage />
    </Suspense>
  );
}

import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-0 flex-1">
      <Suspense fallback={<aside className="w-56 shrink-0 border-r bg-white" />}>
        <AppNav />
      </Suspense>
      <main className="min-w-0 flex-1 overflow-auto px-6 py-6">{children}</main>
    </div>
  );
}

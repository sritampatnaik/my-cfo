import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import "streamdown/styles.css";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1">
      <Suspense fallback={<aside className="w-56 shrink-0 border-r bg-white" />}>
        <AppNav />
      </Suspense>
      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/upload", label: "Upload statements" },
  { href: "/transactions", label: "Transactions" },
];

export function AppNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range = from && to ? `?from=${from}&to=${to}` : "";

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-white px-3 py-5">
      <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        my-cfo
      </p>
      <nav className="mt-6 flex flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href;
          const href = link.href === "/upload" ? link.href : `${link.href}${range}`;
          return (
            <Link
              key={link.href}
              href={href}
              className={`rounded-md px-3 py-2 text-sm ${
                active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

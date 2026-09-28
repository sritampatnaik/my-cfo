import Image from "next/image";
import type { Bank } from "@/lib/banks";

export function BankLogo({ bank, className }: { bank: Bank; className?: string }) {
  return (
    <Image
      src={`/banks/${bank.id}.svg`}
      alt={`${bank.name} logo`}
      width={140}
      height={48}
      className={className ?? "h-8 w-auto max-w-24 object-contain"}
    />
  );
}

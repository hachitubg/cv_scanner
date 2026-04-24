import { ScanSearch } from "lucide-react";

import { cn } from "@/lib/utils";

export function NavIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-[1rem] bg-[linear-gradient(145deg,#a03964,#d6628d)] text-white shadow-[0_12px_28px_rgba(160,57,100,0.22)]",
        className,
      )}
      aria-hidden="true"
    >
      <ScanSearch className="size-5" strokeWidth={2.4} />
    </span>
  );
}

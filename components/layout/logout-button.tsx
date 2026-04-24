"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={
        compact
          ? "inline-flex h-11 items-center justify-center rounded-full border border-white/70 bg-white/80 px-4 text-sm font-extrabold text-on-surface shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
          : "inline-flex h-12 items-center justify-center rounded-full border border-white/70 bg-white/80 px-5 text-sm font-extrabold text-on-surface shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
      }
    >
      <LogOut className="mr-2 h-4 w-4" />
      Đăng xuất
    </button>
  );
}

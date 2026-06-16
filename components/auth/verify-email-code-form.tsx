"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VerifyCodeResponse = {
  error?: string;
  success?: boolean;
};

export function VerifyEmailCodeForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [isPending, startTransition] = useTransition();

  function verify() {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/verify-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = (await response.json()) as VerifyCodeResponse;
      if (!response.ok) {
        setError(data.error || "Không thể kích hoạt tài khoản.");
        return;
      }

      setVerified(true);
    });
  }

  if (verified) {
    return (
      <div className="space-y-4 rounded-[2rem] bg-white/90 p-6 shadow-soft">
        <p className="text-sm font-semibold text-emerald-700">
          Tài khoản đã được kích hoạt. Bạn có thể đăng nhập ngay.
        </p>
        <Link
          href="/login"
          className="inline-flex h-12 items-center justify-center rounded-full bg-cta-gradient px-6 text-sm font-extrabold text-white shadow-bubbly transition duration-200 hover:-translate-y-0.5 hover:shadow-ambient"
        >
          Đi tới đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[2rem] bg-white/90 p-6 shadow-soft">
      <div>
        <label className="label" htmlFor="verify-email">
          Email
        </label>
        <Input
          id="verify-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="name@company.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="verify-code">
          Mã kích hoạt
        </label>
        <Input
          id="verify-code"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
          maxLength={6}
          placeholder="Nhập mã 6 số"
          className="text-center text-2xl font-black tracking-[0.35em]"
        />
      </div>

      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

      <Button
        className="w-full"
        onClick={verify}
        disabled={isPending || !email.trim() || code.length !== 6}
      >
        {isPending ? "Đang kích hoạt..." : "Kích hoạt tài khoản"}
      </Button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginCheckResponse = {
  error?: string;
  code?: string;
  previewUrl?: string;
};

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string>("");
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resendVerification() {
    if (!verificationEmail) return;

    setError(null);
    setResendMessage(null);
    setPreviewUrl(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      });

      const data = (await response.json()) as LoginCheckResponse;

      if (!response.ok) {
        setError(data.error || "Không thể gửi lại email xác minh.");
        return;
      }

      setPreviewUrl(data.previewUrl || null);
      setResendMessage("Đã gửi lại email xác minh.");
    });
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    setResendMessage(null);
    setPreviewUrl(null);

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    setVerificationEmail(email);

    startTransition(async () => {
      const checkResponse = await fetch("/api/auth/login-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const checkData = (await checkResponse.json()) as LoginCheckResponse;

      if (!checkResponse.ok) {
        setError(checkData.error || "Không thể đăng nhập.");
        return;
      }

      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl || "/workspaces",
      });

      if (response?.error) {
        setError("Email hoặc mật khẩu chưa đúng.");
        return;
      }

      router.push(response?.url || callbackUrl || "/workspaces");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <Input id="email" name="email" type="email" placeholder="example@company.com" required />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Mật khẩu
        </label>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </div>

      {error ? (
        <div className="rounded-[1.5rem] bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-700">
          <p>{error}</p>
          {error.includes("chưa xác minh email") && verificationEmail ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Button onClick={resendVerification} disabled={isPending}>
                {isPending ? "Đang gửi lại..." : "Gửi lại email xác minh"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {resendMessage ? <p className="text-sm font-semibold text-emerald-700">{resendMessage}</p> : null}

      {previewUrl ? (
        <div className="rounded-[1.5rem] bg-secondary-container px-4 py-4 text-sm font-semibold text-on-secondary-container">
          <p>Liên kết xác minh thủ công:</p>
          <a href={previewUrl} className="mt-2 block break-all underline">
            {previewUrl}
          </a>
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "Đang đăng nhập..." : "Đăng nhập ngay"}
      </Button>

      <p className="text-center text-sm font-medium text-on-surface-variant">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-black text-primary hover:underline">
          Đăng ký thành viên
        </Link>
      </p>
    </form>
  );
}

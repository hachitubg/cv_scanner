"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RegisterResponse = {
  error?: string;
  email?: string;
  emailSent?: boolean;
  previewUrl?: string;
  requiresEmailVerification?: boolean;
};

type VerifyCodeResponse = {
  error?: string;
  success?: boolean;
};

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegisterResponse | null>(null);
  const [activationCode, setActivationCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resendVerification() {
    if (!success?.email) return;

    setError(null);
    setResendMessage(null);
    setActivationCode("");

    startTransition(async () => {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: success.email }),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        setError(data.error || "Không thể gửi lại mã kích hoạt.");
        return;
      }

      setSuccess((current) =>
        current
          ? {
              ...current,
              emailSent: data.emailSent,
              previewUrl: data.previewUrl,
            }
          : current,
      );
      setResendMessage("Đã gửi lại mã kích hoạt mới.");
    });
  }

  function verifyCode() {
    if (!success?.email) return;

    setError(null);
    setResendMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/verify-email-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: success.email,
          code: activationCode,
        }),
      });

      const data = (await response.json()) as VerifyCodeResponse;

      if (!response.ok) {
        setError(data.error || "Không thể kích hoạt tài khoản.");
        return;
      }

      setVerified(true);
    });
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    setResendMessage(null);
    setVerified(false);

    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    if (payload.password !== payload.confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        setError(data.error || "Không thể tạo tài khoản.");
        return;
      }

      setSuccess(data);
      setActivationCode("");
    });
  }

  if (success?.requiresEmailVerification) {
    return (
      <div className="space-y-5 rounded-[2rem] bg-white/90 p-6 shadow-soft">
        <div className="space-y-2">
          <h3 className="text-xl font-black text-on-surface">
            Nhập mã kích hoạt
          </h3>
          <p className="text-sm font-medium leading-6 text-on-surface-variant">
            Tài khoản đã được tạo cho <strong>{success.email}</strong>. Hãy
            kiểm tra email và nhập mã 6 số để kích hoạt tài khoản.
          </p>
        </div>

        <div className="rounded-[1.5rem] bg-surface-container-low px-4 py-4 text-sm font-medium text-on-surface-variant">
          {success.emailSent
            ? "Mã kích hoạt đã được gửi tới email đăng ký."
            : "Email service chưa gửi thành công. Có thể dùng link test bên dưới trong môi trường local."}
        </div>

        {verified ? (
          <div className="rounded-[1.5rem] bg-emerald-100 px-4 py-4 text-sm font-semibold text-emerald-800">
            Tài khoản đã được kích hoạt. Bạn có thể đăng nhập ngay.
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              value={activationCode}
              onChange={(event) =>
                setActivationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              maxLength={6}
              placeholder="Nhập mã 6 số"
              className="text-center text-2xl font-black tracking-[0.35em]"
            />
            <Button
              className="w-full"
              onClick={verifyCode}
              disabled={isPending || activationCode.length !== 6}
            >
              {isPending ? "Đang kích hoạt..." : "Kích hoạt tài khoản"}
            </Button>
          </div>
        )}

        {success.previewUrl ? (
          <div className="rounded-[1.5rem] bg-secondary-container px-4 py-4 text-sm font-semibold text-on-secondary-container">
            <p>Trang xác minh thủ công:</p>
            <a href={success.previewUrl} className="mt-2 block break-all underline">
              {success.previewUrl}
            </a>
          </div>
        ) : null}

        {resendMessage ? (
          <p className="text-sm font-semibold text-emerald-700">{resendMessage}</p>
        ) : null}
        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          {!verified ? (
            <Button onClick={resendVerification} disabled={isPending}>
              {isPending ? "Đang gửi lại..." : "Gửi lại mã kích hoạt"}
            </Button>
          ) : null}
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold text-on-surface transition hover:bg-surface-container-high"
          >
            Đi tới đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div>
        <label className="label" htmlFor="name">
          Họ và tên
        </label>
        <Input id="name" name="name" placeholder="Nguyễn Văn A" required />
      </div>

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <Input id="email" name="email" type="email" placeholder="name@company.com" required />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Mật khẩu
        </label>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </div>

      <div>
        <label className="label" htmlFor="confirmPassword">
          Xác nhận mật khẩu
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
        />
      </div>

      {error ? (
        <div className="rounded-[1.5rem] bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "Đang tạo tài khoản..." : "Đăng ký ngay"}
      </Button>

      <p className="text-center text-sm font-medium text-on-surface-variant">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-black text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

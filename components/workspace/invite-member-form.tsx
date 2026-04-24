"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"HR" | "HR_ADMIN" | "MANAGER">("HR");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function invite() {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error || "Không thể thêm thành viên.");
        return;
      }

      setEmail("");
      setRole("HR");
      router.refresh();
    });
  }

  return (
    <div className="rounded-[2rem] bg-surface-container-low p-5">
      <h3 className="text-lg font-black text-on-surface">Thêm thành viên theo email</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">
        Người dùng phải tự đăng ký và xác minh email trước. Sau đó bạn mới thêm họ vào workspace bằng đúng email đã đăng ký.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_200px_auto]">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email đồng đội" />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as "HR" | "HR_ADMIN" | "MANAGER")}
          className="field"
        >
          <option value="HR">HR</option>
          <option value="MANAGER">Quản lý</option>
          <option value="HR_ADMIN">HR Admin</option>
        </select>
        <Button onClick={invite} disabled={isPending || !email.trim()}>
          {isPending ? "Đang thêm..." : "Thêm vào workspace"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

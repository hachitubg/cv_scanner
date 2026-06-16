"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { workspaceRoleMeta } from "@/lib/utils";
import { WORKSPACE_ROLES, type WorkspaceRoleType } from "@/types";

type InviteMemberResponse = {
  error?: string;
  emailSent?: boolean;
  previewUrl?: string;
};

export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRoleType>("HR");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function invite() {
    setError(null);
    setSuccess(null);
    setPreviewUrl(null);

    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = (await response.json()) as InviteMemberResponse;

      if (!response.ok) {
        setError(data.error || "Không thể gửi lời mời.");
        return;
      }

      setEmail("");
      setRole("HR");
      setSuccess(
        data.emailSent
          ? "Đã gửi lời mời qua email. Người dùng cần bấm chấp nhận trong email để vào workspace."
          : "Đã tạo lời mời. Email chưa gửi thành công, có thể dùng link test bên dưới.",
      );
      setPreviewUrl(data.previewUrl || null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-[2rem] bg-surface-container-low p-5">
      <h3 className="text-lg font-black text-on-surface">
        Mời thành viên qua email
      </h3>
      <p className="mt-2 text-sm font-medium leading-6 text-on-surface-variant">
        Người được mời sẽ nhận email và chỉ được thêm vào workspace sau khi
        bấm chấp nhận lời mời bằng đúng email đó.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_200px_auto]">
        <Input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email đồng đội"
          type="email"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as WorkspaceRoleType)}
          className="field"
        >
          {WORKSPACE_ROLES.map((item) => (
            <option key={item} value={item}>
              {workspaceRoleMeta[item]}
            </option>
          ))}
        </select>
        <Button onClick={invite} disabled={isPending || !email.trim()}>
          {isPending ? "Đang gửi..." : "Gửi lời mời"}
        </Button>
      </div>
      {success ? <p className="mt-3 text-sm font-semibold text-emerald-700">{success}</p> : null}
      {previewUrl ? (
        <div className="mt-3 rounded-[1.2rem] bg-secondary-container px-4 py-3 text-sm font-semibold text-on-secondary-container">
          <p>Link lời mời thủ công:</p>
          <a href={previewUrl} className="mt-1 block break-all underline">
            {previewUrl}
          </a>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

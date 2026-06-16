"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { workspaceRoleMeta } from "@/lib/utils";
import { WORKSPACE_ROLES, type WorkspaceRoleType } from "@/types";

type Member = {
  userId: string;
  role: WorkspaceRoleType;
  joinedAt: Date | string;
  user: {
    name: string;
    email: string;
  };
};

type PendingInvitation = {
  id: string;
  invitedEmail: string;
  role: WorkspaceRoleType;
  createdAt: Date | string;
  expiresAt: Date | string;
  invitedByName: string;
};

export function MembersManager({
  workspaceId,
  members,
  pendingInvitations,
  canManage,
}: {
  workspaceId: string;
  members: Member[];
  pendingInvitations: PendingInvitation[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateMemberRole(userId: string, role: WorkspaceRoleType) {
    setError(null);
    setSuccess(null);
    setPendingMemberId(userId);

    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error || "Không thể cập nhật role thành viên.");
        setPendingMemberId(null);
        return;
      }

      setSuccess("Đã cập nhật role thành viên.");
      setPendingMemberId(null);
      router.refresh();
    });
  }

  function removeMember(userId: string) {
    if (!window.confirm("Xóa thành viên này khỏi workspace?")) return;

    setError(null);
    setSuccess(null);
    setPendingMemberId(userId);
    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error || "Không thể xóa thành viên.");
        setPendingMemberId(null);
        return;
      }

      setPendingMemberId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canManage ? <InviteMemberForm workspaceId={workspaceId} /> : null}

      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm font-semibold text-emerald-700">{success}</p> : null}

      <div className="bubbly-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-outline">Thành viên</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-outline">Vai trò</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-outline">Tham gia</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-outline">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className="border-t border-surface-container-low">
                  <td className="px-6 py-5">
                    <p className="font-black text-on-surface">{member.user.name}</p>
                    <p className="mt-1 text-sm font-medium text-on-surface-variant">{member.user.email}</p>
                  </td>
                  <td className="px-6 py-5">
                    {canManage ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className={getRoleBadgeClassName(member.role)}>
                          {workspaceRoleMeta[member.role]}
                        </Badge>
                        <select
                          value={member.role}
                          onChange={(event) =>
                            updateMemberRole(
                              member.userId,
                              event.target.value as WorkspaceRoleType,
                            )
                          }
                          disabled={isPending && pendingMemberId === member.userId}
                          className="h-10 rounded-[0.9rem] border border-primary/10 bg-white px-3 text-sm font-bold text-on-surface outline-none transition focus:border-primary/25 focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
                          aria-label={`Đổi role cho ${member.user.name}`}
                        >
                          {WORKSPACE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {workspaceRoleMeta[role]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <Badge className={getRoleBadgeClassName(member.role)}>
                        {workspaceRoleMeta[member.role]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-5 text-sm font-semibold text-on-surface-variant">
                    {new Date(member.joinedAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-6 py-5">
                    {canManage ? (
                      <Button
                        variant="ghost"
                        onClick={() => removeMember(member.userId)}
                        disabled={isPending && pendingMemberId === member.userId}
                      >
                        Xóa khỏi workspace
                      </Button>
                    ) : (
                      <span className="text-sm font-semibold text-on-surface-variant">Không áp dụng</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingInvitations.length ? (
        <div className="bubbly-card p-5">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">
            Lời mời đang chờ
          </p>
          <div className="mt-4 grid gap-3">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-surface-container-low px-4 py-3"
              >
                <div>
                  <p className="font-black text-on-surface">
                    {invitation.invitedEmail}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-on-surface-variant">
                    Mời bởi {invitation.invitedByName} • Hết hạn{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <Badge className={getRoleBadgeClassName(invitation.role)}>
                  {workspaceRoleMeta[invitation.role]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getRoleBadgeClassName(role: WorkspaceRoleType) {
  if (role === "HR_ADMIN") return "bg-primary-fixed text-on-primary-container";
  if (role === "MANAGER") return "bg-tertiary-container text-on-tertiary-container";
  return "bg-secondary-container text-on-secondary-container";
}

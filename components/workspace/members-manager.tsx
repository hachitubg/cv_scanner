"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { workspaceRoleMeta } from "@/lib/utils";

type Member = {
  userId: string;
  role: "HR_ADMIN" | "HR" | "MANAGER";
  joinedAt: Date | string;
  user: {
    name: string;
    email: string;
  };
};

export function MembersManager({
  workspaceId,
  members,
  canManage,
}: {
  workspaceId: string;
  members: Member[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function removeMember(userId: string) {
    if (!window.confirm("Xóa thành viên này khỏi workspace?")) return;

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error || "Không thể xóa thành viên.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canManage ? <InviteMemberForm workspaceId={workspaceId} /> : null}

      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

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
                    <Badge
                      className={
                        member.role === "HR_ADMIN"
                          ? "bg-primary-fixed text-on-primary-container"
                          : member.role === "MANAGER"
                            ? "bg-tertiary-container text-on-tertiary-container"
                            : "bg-secondary-container text-on-secondary-container"
                      }
                    >
                      {workspaceRoleMeta[member.role]}
                    </Badge>
                  </td>
                  <td className="px-6 py-5 text-sm font-semibold text-on-surface-variant">
                    {new Date(member.joinedAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-6 py-5">
                    {canManage ? (
                      <Button variant="ghost" onClick={() => removeMember(member.userId)} disabled={isPending}>
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
    </div>
  );
}

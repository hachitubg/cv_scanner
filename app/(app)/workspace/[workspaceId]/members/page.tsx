import { notFound, redirect } from "next/navigation";

import { MembersManager } from "@/components/workspace/members-manager";
import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceMembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceId } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!workspace) notFound();

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  return (
    <main className="space-y-6">
      <section className="bubbly-card p-6">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Thành viên workspace</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-on-surface">Đồng đội của bạn</h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-on-surface-variant">
          Người dùng tự đăng ký, xác minh email, rồi HR Admin thêm họ vào workspace bằng email để gán role HR, HR Admin hoặc Quản lý.
        </p>
      </section>

      <MembersManager
        workspaceId={workspaceId}
        members={workspace.members.map((member) => ({
          ...member,
          role: member.role as "HR_ADMIN" | "HR" | "MANAGER",
        }))}
        canManage={true}
      />
    </main>
  );
}

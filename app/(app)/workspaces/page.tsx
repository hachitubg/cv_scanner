import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/layout/logout-button";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, workspaceRoleMeta } from "@/lib/utils";
import type { WorkspaceRoleType } from "@/types";

export default async function WorkspacesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const workspaces =
    session.user.role === "ADMIN"
      ? await prisma.workspace.findMany({
          include: {
            owner: true,
            members: true,
            candidates: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.workspaceMember.findMany({
          where: { userId: session.user.id },
          include: {
            workspace: {
              include: {
                owner: true,
                members: true,
                candidates: true,
              },
            },
          },
          orderBy: { joinedAt: "desc" },
        });

  return (
    <main className="page-shell py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Workspace Hub</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight text-on-surface">
            Không gian làm việc của bạn
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-on-surface-variant">
            Chọn workspace để tiếp tục xử lý CV, xem dashboard tuyển dụng hoặc cập nhật pipeline ứng viên.
          </p>
        </div>
        {session.user.role === "ADMIN" ? (
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white">Admin toàn hệ thống</Badge>
            <LogoutButton />
          </div>
        ) : (
          <LogoutButton />
        )}
      </div>

      <div className="mt-8">
        <CreateWorkspaceForm />
      </div>

      <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((item) => {
          const workspace = "workspace" in item ? item.workspace : item;
          const membershipRole = ("workspace" in item
            ? item.role
            : workspace.ownerId === session.user.id
              ? "HR_ADMIN"
              : "HR") as WorkspaceRoleType;

          return (
            <Link key={workspace.id} href={`/workspace/${workspace.id}/dashboard`}>
              <Card className="h-full transition hover:-translate-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-[1.5rem] bg-primary-container px-4 py-3">
                    <p className="text-xl font-black text-on-primary-container">{workspace.name.slice(0, 1)}</p>
                  </div>
                  <Badge className="bg-tertiary-container text-on-tertiary-container">
                    {workspaceRoleMeta[membershipRole]}
                  </Badge>
                </div>
                <h2 className="mt-6 text-2xl font-black text-on-surface">{workspace.name}</h2>
                <p className="mt-2 text-sm font-medium text-on-surface-variant">
                  Chủ workspace: {workspace.owner.name}
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-[1.5rem] bg-surface-container-low p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-outline">Thành viên</p>
                    <p className="mt-2 text-2xl font-black text-on-surface">{workspace.members.length}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-surface-container-low p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-outline">CV</p>
                    <p className="mt-2 text-2xl font-black text-on-surface">{workspace.candidates.length}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-surface-container-low p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-outline">Ngày tạo</p>
                    <p className="mt-2 text-sm font-black text-on-surface">{formatDate(workspace.createdAt)}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

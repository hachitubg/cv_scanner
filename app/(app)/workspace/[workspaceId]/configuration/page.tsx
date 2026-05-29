import { notFound, redirect } from "next/navigation";

import { ConfigurationManager } from "@/components/workspace/configuration-manager";
import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWorkspaceDropdownOptions } from "@/lib/workspace-config";
import type { WorkspaceDropdownType } from "@/types";

export default async function WorkspaceConfigurationPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  await ensureDefaultWorkspaceDropdownOptions(workspaceId);

  const [workspace, projects, positionOptions, noHireReasonOptions] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
    }),
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workspaceDropdownOption.findMany({
      where: { workspaceId, type: "POSITION" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workspaceDropdownOption.findMany({
      where: { workspaceId, type: "NO_HIRE_REASON" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!workspace) notFound();

  return (
    <main className="space-y-6">
      <section className="bubbly-card p-6">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">
          Cấu hình
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-on-surface">
          Quản lý dữ liệu Dropdown
        </h1>
        <p className="mt-3 max-w-3xl text-base font-medium leading-8 text-on-surface-variant">
          Tạo và quản lý các danh mục dùng trong form CV như dự án tuyển dụng,
          vị trí ứng tuyển và các nhóm cấu hình khác sẽ được mở rộng sau này.
        </p>
      </section>

      <ConfigurationManager
        workspaceId={workspaceId}
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
        }))}
        positionOptions={positionOptions.map((option) => ({
          id: option.id,
          type: option.type as WorkspaceDropdownType,
          name: option.name,
          description: option.description,
        }))}
        noHireReasonOptions={noHireReasonOptions.map((option) => ({
          id: option.id,
          type: option.type as WorkspaceDropdownType,
          name: option.name,
          description: option.description,
        }))}
      />
    </main>
  );
}

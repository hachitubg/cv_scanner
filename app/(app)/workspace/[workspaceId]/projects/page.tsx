import { notFound, redirect } from "next/navigation";

import { ProjectsManager } from "@/components/workspace/projects-manager";
import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceProjectsPage({
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

  const [workspace, projects] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
    }),
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!workspace) notFound();

  return (
    <main className="space-y-6">
      <section className="bubbly-card p-6">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Dự án</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-on-surface">Quản lý dự án tuyển dụng</h1>
        <p className="mt-3 max-w-3xl text-base font-medium leading-8 text-on-surface-variant">
          Tạo danh sách dự án để HR gắn ứng viên đúng nhu cầu tuyển dụng và giúp quản lý đọc danh sách nhanh hơn.
        </p>
      </section>

      <ProjectsManager workspaceId={workspaceId} projects={projects} />
    </main>
  );
}

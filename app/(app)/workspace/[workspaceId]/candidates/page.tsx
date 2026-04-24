import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CandidatesFiltersBar } from "@/components/candidates/candidates-filters-bar";
import { CandidatesListManager } from "@/components/candidates/candidates-list-manager";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function CandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    search?: string;
    status?: string;
    hrId?: string;
    position?: string;
    projectId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceId } = await params;
  const filters = await searchParams;

  let membership: Awaited<ReturnType<typeof requireWorkspaceAccess>> | null = null;
  try {
    membership = await requireWorkspaceAccess(workspaceId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  const isManager = session.user.role !== "ADMIN" && membership!.membershipRole === "MANAGER";

  const [workspace, members, projects, candidates] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.candidate.findMany({
      where: {
        workspaceId,
        ...(filters.search
          ? {
              OR: [
                { fullName: { contains: filters.search } },
                { position: { contains: filters.search } },
                { email: { contains: filters.search } },
              ],
            }
          : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.hrId ? { hrId: filters.hrId } : {}),
        ...(filters.position ? { position: { contains: filters.position } } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
      },
      include: {
        hr: true,
        project: true,
        managerReviewedBy: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!workspace) notFound();

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.2rem] bg-white/84 p-6 shadow-[0_28px_70px_rgba(160,57,100,0.1)] backdrop-blur-xl">
        <div className="absolute -left-10 top-0 h-28 w-28 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-secondary/12 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Kho CV</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-on-surface">Danh sách ứng viên</h1>
            <p className="mt-3 text-base font-medium leading-8 text-on-surface-variant">
              {isManager
                ? "Xem nhanh danh sách đã được lọc sẵn, mở CV và duyệt đề xuất tuyển dụng ngay trên từng ứng viên."
                : "Quản lý hồ sơ theo trạng thái, dự án tuyển dụng và chia sẻ nhanh danh sách đã lọc cho quản lý."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-[1.4rem] bg-surface-container-low px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">Workspace</p>
              <p className="mt-1 text-sm font-black text-on-surface">{workspace.name}</p>
            </div>
            {!isManager ? (
              <Link href={`/workspace/${workspaceId}/candidates/upload`}>
                <Button className="min-w-40">Upload CV mới</Button>
              </Link>
            ) : null}
          </div>
        </div>

        <CandidatesFiltersBar
          members={members
            .filter((member) => member.role !== "MANAGER")
            .map((member) => ({
              id: member.userId,
              name: member.user.name,
              email: member.user.email,
              role: member.role as "HR_ADMIN" | "HR" | "MANAGER",
            }))}
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
          }))}
          initialFilters={filters}
        />
      </section>

      <CandidatesListManager
        workspaceId={workspaceId}
        currentUserId={session.user.id}
        membershipRole={membership!.membershipRole}
        candidates={candidates.map((candidate) => ({
          id: candidate.id,
          fullName: candidate.fullName,
          position: candidate.position,
          source: candidate.source,
          status: candidate.status,
          createdAt: candidate.createdAt,
          interviewDate: candidate.interviewDate,
          interviewerName: candidate.interviewerName,
          projectName: candidate.project?.name ?? null,
          managerDecision: candidate.managerDecision ?? "PENDING",
          managerOfferSalary: candidate.managerOfferSalary,
          managerReviewNote: candidate.managerReviewNote,
          managerReviewedAt: candidate.managerReviewedAt,
          managerReviewedByName: candidate.managerReviewedBy?.name ?? null,
          hrId: candidate.hrId,
          hr: {
            name: candidate.hr.name,
          },
        }))}
      />
    </main>
  );
}

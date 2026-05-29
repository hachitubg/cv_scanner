import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CandidatesListManager } from "@/components/candidates/candidates-list-manager";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWorkspaceDropdownOptions } from "@/lib/workspace-config";

export default async function CandidatesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceId } = await params;

  let membership: Awaited<ReturnType<typeof requireWorkspaceAccess>> | null =
    null;
  try {
    membership = await requireWorkspaceAccess(
      workspaceId,
      session.user.id,
      session.user.role,
    );
  } catch {
    notFound();
  }

  const isManager =
    session.user.role !== "ADMIN" && membership!.membershipRole === "MANAGER";

  await ensureDefaultWorkspaceDropdownOptions(workspaceId);

  const [workspace, candidates, noHireReasonOptions] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.candidate.findMany({
      where: {
        workspaceId,
      },
      include: {
        hr: true,
        project: true,
        managerReviewedBy: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.workspaceDropdownOption.findMany({
      where: { workspaceId, type: "NO_HIRE_REASON" },
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
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">
              Kho CV
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-on-surface">
              Danh sách ứng viên
            </h1>
            <p className="mt-3 text-base font-medium leading-8 text-on-surface-variant">
              {isManager
                ? "Xem nhanh danh sách CV, mở hồ sơ và duyệt đề xuất tuyển dụng ngay trên từng ứng viên."
                : "Quản lý hồ sơ bằng bảng Excel với lọc, sắp xếp, ghim cột và thao tác nhanh trên từng ứng viên."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-[1.4rem] bg-surface-container-low px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-outline">
                Workspace
              </p>
              <p className="mt-1 text-sm font-black text-on-surface">
                {workspace.name}
              </p>
            </div>
            {!isManager ? (
              <Link href={`/workspace/${workspaceId}/candidates/upload`}>
                <Button className="min-w-40">Upload CV mới</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <CandidatesListManager
        workspaceId={workspaceId}
        currentUserId={session.user.id}
        membershipRole={membership!.membershipRole}
        candidates={candidates.map((candidate) => ({
          id: candidate.id,
          fullName: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone,
          summary: candidate.summary,
          position: candidate.position,
          source: candidate.source,
          expectedSalary: candidate.expectedSalary,
          offerSalary: candidate.offerSalary,
          notes: candidate.notes,
          status: candidate.status,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
          interviewDate: candidate.interviewDate,
          interviewerName: candidate.interviewerName,
          projectName: candidate.project?.name ?? null,
          managerDecision: candidate.managerDecision ?? "PENDING",
          managerOfferSalary: candidate.managerOfferSalary,
          managerReviewNote: candidate.managerReviewNote,
          managerReviewedAt: candidate.managerReviewedAt,
          managerReviewedByName: candidate.managerReviewedBy?.name ?? null,
          noHireReason: candidate.noHireReason,
          hrId: candidate.hrId,
          hr: {
            name: candidate.hr.name,
          },
        }))}
        noHireReasonOptions={noHireReasonOptions.map((option) => ({
          id: option.id,
          type: "NO_HIRE_REASON",
          name: option.name,
          description: option.description,
        }))}
      />
    </main>
  );
}

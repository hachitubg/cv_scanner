import { notFound, redirect } from "next/navigation";

import { CandidateDetailForm } from "@/components/candidates/candidate-detail-form";
import { auth } from "@/lib/auth";
import {
  canEditWorkspaceCandidate,
  canManageCandidate,
  requireWorkspaceHrAdmin,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; candidateId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceId, candidateId } = await params;

  let access: Awaited<ReturnType<typeof canManageCandidate>> | null = null;
  try {
    access = await canManageCandidate(candidateId, session.user.id, session.user.role);
    if (access.candidate.workspaceId !== workspaceId) {
      notFound();
    }
  } catch {
    notFound();
  }

  const membershipRole = access!.membership.membershipRole;
  const isManagerView = session.user.role !== "ADMIN" && membershipRole === "MANAGER";
  const canEditCandidateData = canEditWorkspaceCandidate(
    access!.candidate.hrId,
    session.user.id,
    membershipRole,
    session.user.role,
  );

  const [candidate, members, projects] = await Promise.all([
    prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        cvFile: true,
        project: true,
        managerReviewedBy: true,
        statusHistory: {
          include: {
            changedByUser: true,
          },
          orderBy: { changedAt: "desc" },
        },
      },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!candidate) notFound();

  let canDelete = false;
  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
    canDelete = true;
  } catch {}

  return (
    <main className="space-y-6">
      <section className="bubbly-card p-6">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Chi tiết ứng viên</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-on-surface">
          {candidate.fullName || "Ứng viên chưa đặt tên"}
        </h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-on-surface-variant">
          {isManagerView
            ? "Đọc hồ sơ, đối chiếu đề xuất tuyển dụng và chốt kết quả nhân sự trực tiếp."
            : canEditCandidateData
              ? "Chỉnh sửa thông tin cá nhân, cập nhật pipeline, gắn dự án và quản lý lịch phỏng vấn tại một nơi."
              : "HR có thể đọc hồ sơ này nhưng chỉ HR phụ trách hoặc HR Admin mới được cập nhật dữ liệu."}
        </p>
      </section>

      <CandidateDetailForm
        workspaceId={workspaceId}
        currentUserId={session.user.id}
        membershipRole={membershipRole}
        candidate={{
          ...candidate,
          statusHistory: candidate.statusHistory.map((entry) => ({
            ...entry,
            changedAt: entry.changedAt,
          })),
        }}
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
        canDelete={canDelete}
        canEditCandidateData={canEditCandidateData}
        canReviewCandidate={session.user.role === "ADMIN" || membershipRole === "MANAGER" || membershipRole === "HR_ADMIN"}
      />
    </main>
  );
}

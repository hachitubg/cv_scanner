import { notFound, redirect } from "next/navigation";

import { UploadCandidateForm } from "@/components/candidates/upload-form";
import { auth } from "@/lib/auth";
import { requireWorkspaceHrActor } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function UploadCandidatePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceId } = await params;

  let membership;
  try {
    membership = await requireWorkspaceHrActor(workspaceId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  const [members, projects] = await Promise.all([
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

  return (
    <main className="space-y-6">
      <section className="bubbly-card p-6">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Upload CV mới</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-on-surface">Quét và tạo ứng viên</h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-on-surface-variant">
          Chọn file, quét nội dung CV, gắn đúng dự án tuyển dụng và xác nhận thông tin trước khi lưu vào hệ thống.
        </p>
      </section>

      <UploadCandidateForm
        workspaceId={workspaceId}
        currentUserId={session.user.id}
        membershipRole={membership!.membershipRole}
        members={members.map((member) => ({
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
      />
    </main>
  );
}

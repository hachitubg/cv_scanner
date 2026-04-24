import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  canAssignCandidateToHr,
  canEditWorkspaceCandidate,
  canManageCandidate,
  canManagerUpdateCandidateStatus,
  isManagerMembership,
  isWorkspaceManagerOrAdmin,
  requireWorkspaceHrAdmin,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { stringifySkills } from "@/lib/utils";
import { CANDIDATE_STATUSES, MANAGER_DECISIONS } from "@/types";

const candidateUpdateSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  hometown: z.string().optional(),
  school: z.string().optional(),
  graduationYear: z.string().optional(),
  yearsOfExperience: z.number().nullable().optional(),
  summary: z.string().optional(),
  position: z.string().optional(),
  source: z.string().optional(),
  offerSalary: z.string().optional(),
  notes: z.string().optional(),
  interviewDate: z.string().optional(),
  interviewerName: z.string().optional(),
  interviewFeedback: z.string().optional(),
  skills: z.array(z.string()).optional(),
  hrId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  status: z.enum(CANDIDATE_STATUSES).optional(),
  statusNote: z.string().optional(),
  managerDecision: z.union([z.enum(MANAGER_DECISIONS), z.literal("")]).optional(),
  managerOfferSalary: z.string().optional(),
  managerReviewNote: z.string().optional(),
});

const managerEditableKeys = new Set([
  "managerDecision",
  "managerOfferSalary",
  "managerReviewNote",
  "status",
  "statusNote",
]);

function requiresInterviewDetails(status: string) {
  return status === "INTERVIEW" || status === "INTERVIEWED";
}

async function ensureProjectInWorkspace(projectId: string | null, workspaceId: string) {
  if (!projectId) return null;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return project.id;
}

async function ensureAssignableHr(workspaceId: string, hrId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: hrId,
      },
    },
    select: {
      userId: true,
      role: true,
    },
  });

  if (!membership || !["HR", "HR_ADMIN"].includes(membership.role)) {
    throw new Error("INVALID_HR");
  }

  return membership.userId;
}

export async function GET(_: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { candidateId } = await params;

  try {
    await canManageCandidate(candidateId, session.user.id, session.user.role);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "NOT_FOUND"
            ? "Không tìm thấy ứng viên."
            : "Bạn không có quyền xem ứng viên này.",
      },
      { status: error instanceof Error && error.message === "NOT_FOUND" ? 404 : 403 },
    );
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      hr: true,
      workspace: true,
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
  });

  return NextResponse.json(candidate);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { candidateId } = await params;

  let currentCandidate;
  let membership;
  try {
    ({ candidate: currentCandidate, membership } = await canManageCandidate(
      candidateId,
      session.user.id,
      session.user.role,
    ));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "NOT_FOUND"
            ? "Không tìm thấy ứng viên."
            : "Bạn không có quyền cập nhật ứng viên này.",
      },
      { status: error instanceof Error && error.message === "NOT_FOUND" ? 404 : 403 },
    );
  }

  const body = await request.json();
  const parsed = candidateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const submittedKeys = Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  const isManagerSession = session.user.role !== "ADMIN" && isManagerMembership(membership.membershipRole);
  const canEditCandidateData = canEditWorkspaceCandidate(
    currentCandidate.hrId,
    session.user.id,
    membership.membershipRole,
    session.user.role,
  );

  if (isManagerSession) {
    const disallowedKeys = submittedKeys.filter((key) => !managerEditableKeys.has(key));
    if (disallowedKeys.length) {
      return NextResponse.json(
        { error: "Tài khoản Quản lý chỉ được đánh giá và chốt kết quả nhân sự." },
        { status: 403 },
      );
    }
  } else if (submittedKeys.length && !canEditCandidateData && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "HR chỉ được cập nhật các CV do mình phụ trách." },
      { status: 403 },
    );
  }

  const hasManagerReviewUpdate = submittedKeys.some((key) =>
    ["managerDecision", "managerOfferSalary", "managerReviewNote"].includes(key),
  );
  if (hasManagerReviewUpdate && !isWorkspaceManagerOrAdmin(membership.membershipRole, session.user.role)) {
    return NextResponse.json(
      { error: "Chỉ Quản lý, HR Admin hoặc Admin mới có thể duyệt đề xuất tuyển dụng." },
      { status: 403 },
    );
  }

  if (!canManagerUpdateCandidateStatus(parsed.data.status, membership.membershipRole, session.user.role)) {
    return NextResponse.json(
      { error: "Quản lý chỉ được chốt các trạng thái cuối như offer, từ chối hoặc nhận việc." },
      { status: 403 },
    );
  }

  const nextStatus = parsed.data.status;
  const resolvedStatus = nextStatus ?? currentCandidate.status;
  const nextInterviewDate = parsed.data.interviewDate ?? currentCandidate.interviewDate ?? "";
  const nextInterviewerName = parsed.data.interviewerName ?? currentCandidate.interviewerName ?? "";

  if (requiresInterviewDetails(resolvedStatus) && (!nextInterviewDate.trim() || !nextInterviewerName.trim())) {
    return NextResponse.json(
      { error: "Khi chuyển sang trạng thái phỏng vấn, cần nhập ngày phỏng vấn và người phỏng vấn." },
      { status: 400 },
    );
  }

  let projectId = currentCandidate.projectId;
  if (parsed.data.projectId !== undefined) {
    try {
      projectId = await ensureProjectInWorkspace(parsed.data.projectId, currentCandidate.workspaceId);
    } catch (error) {
      if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
        return NextResponse.json({ error: "Dự án đã chọn không thuộc workspace này." }, { status: 400 });
      }
      throw error;
    }
  }

  let hrId = currentCandidate.hrId;
  if (parsed.data.hrId !== undefined) {
    if (
      !canAssignCandidateToHr(parsed.data.hrId, session.user.id, membership.membershipRole, session.user.role)
    ) {
      return NextResponse.json({ error: "HR chỉ được nhận CV của chính mình." }, { status: 403 });
    }

    try {
      hrId = await ensureAssignableHr(currentCandidate.workspaceId, parsed.data.hrId);
    } catch {
      return NextResponse.json({ error: "Người phụ trách phải là HR hoặc HR Admin trong workspace." }, { status: 400 });
    }
  }

  const managerDecisionValue =
    parsed.data.managerDecision === undefined
      ? undefined
      : parsed.data.managerDecision === ""
        ? "PENDING"
        : parsed.data.managerDecision;

  const updatedCandidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      ...(isManagerSession
        ? {
            status: nextStatus ?? undefined,
          }
        : {
            fullName: parsed.data.fullName,
            email: parsed.data.email,
            phone: parsed.data.phone,
            dateOfBirth: parsed.data.dateOfBirth,
            address: parsed.data.address,
            hometown: parsed.data.hometown,
            school: parsed.data.school,
            graduationYear: parsed.data.graduationYear,
            yearsOfExperience: parsed.data.yearsOfExperience,
            summary: parsed.data.summary,
            position: parsed.data.position,
            source: parsed.data.source,
            offerSalary: parsed.data.offerSalary,
            notes: parsed.data.notes,
            interviewDate: parsed.data.interviewDate,
            interviewerName: parsed.data.interviewerName,
            interviewFeedback: parsed.data.interviewFeedback,
            hrId,
            projectId,
            skillsJson: parsed.data.skills ? stringifySkills(parsed.data.skills) : undefined,
            status: nextStatus ?? undefined,
          }),
      ...(hasManagerReviewUpdate
        ? {
            managerDecision: managerDecisionValue,
            managerOfferSalary: parsed.data.managerOfferSalary,
            managerReviewNote: parsed.data.managerReviewNote,
            managerReviewedAt: new Date(),
            managerReviewedById: session.user.id,
          }
        : {}),
    },
  });

  if (nextStatus && nextStatus !== currentCandidate.status) {
    await prisma.statusHistory.create({
      data: {
        candidateId,
        fromStatus: currentCandidate.status,
        toStatus: nextStatus,
        changedBy: session.user.id,
        note: parsed.data.statusNote || null,
      },
    });
  }

  return NextResponse.json(updatedCandidate);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { candidateId } = await params;

  let permission;
  try {
    permission = await canManageCandidate(candidateId, session.user.id, session.user.role);
    await requireWorkspaceHrAdmin(permission.candidate.workspaceId, session.user.id, session.user.role);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "NOT_FOUND"
            ? "Không tìm thấy ứng viên."
            : "Bạn không có quyền xóa ứng viên này.",
      },
      { status: error instanceof Error && error.message === "NOT_FOUND" ? 404 : 403 },
    );
  }

  await prisma.candidate.delete({
    where: { id: candidateId },
  });

  return NextResponse.json({ success: true });
}

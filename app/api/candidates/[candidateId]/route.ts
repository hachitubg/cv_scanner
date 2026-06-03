import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  canAssignCandidateToHr,
  canEditWorkspaceCandidate,
  canManageCandidate,
  isManagerMembership,
  isWorkspaceManagerOrAdmin,
  requireWorkspaceHrAdmin,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  normalizeCandidateStatus,
  stringifySkills,
  toBirthYear,
} from "@/lib/utils";
import {
  CANDIDATE_STATUSES,
  MANAGER_DECISIONS,
} from "@/types";

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
  expectedSalary: z.string().optional(),
  offerSalary: z.string().optional(),
  notes: z.string().optional(),
  interviewDate: z.string().optional(),
  interviewerName: z.string().optional(),
  interviewFeedback: z.string().optional(),
  skills: z.array(z.string()).optional(),
  hrId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  status: z.enum(CANDIDATE_STATUSES).optional(),
  noHireReason: z.string().optional(),
  statusNote: z.string().optional(),
  managerDecision: z
    .union([z.enum(MANAGER_DECISIONS), z.literal("")])
    .optional(),
  managerOfferSalary: z.string().optional(),
  managerReviewNote: z.string().optional(),
});

const managerEditableKeys = new Set([
  "managerDecision",
  "managerReviewNote",
  "status",
  "statusNote",
  "interviewDate",
  "interviewerName",
  "noHireReason",
]);

function requiresInterviewDetails(status: string) {
  return status === "INTERVIEW";
}

async function ensureProjectInWorkspace(
  projectId: string | null,
  workspaceId: string,
) {
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

function normalizeHistoryValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "Chưa có";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Chưa có";
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.length ? parsed.join(", ") : "Chưa có";
      }
    } catch {}
  }
  return String(value);
}

function hasValueChanged(previous: unknown, next: unknown) {
  return normalizeHistoryValue(previous) !== normalizeHistoryValue(next);
}

function formatHistoryChange(label: string, previous: unknown, next: unknown) {
  return `${label}: ${normalizeHistoryValue(previous)} -> ${normalizeHistoryValue(next)}`;
}

function appendChange(
  changes: string[],
  label: string,
  previous: unknown,
  next: unknown,
) {
  if (next === undefined) return;
  if (hasValueChanged(previous, next)) {
    changes.push(formatHistoryChange(label, previous, next));
  }
}

async function findDuplicateCandidateEmail(email: string, candidateId: string) {
  return prisma.$queryRaw<Array<{ id: string; fullName: string | null }>>`
    SELECT id, fullName
    FROM Candidate
    WHERE id != ${candidateId}
      AND email IS NOT NULL
      AND lower(trim(email)) = lower(${email})
    LIMIT 1
  `;
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
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
      {
        status:
          error instanceof Error && error.message === "NOT_FOUND" ? 404 : 403,
      },
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
      {
        status:
          error instanceof Error && error.message === "NOT_FOUND" ? 404 : 403,
      },
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
  const isManagerSession =
    session.user.role !== "ADMIN" &&
    isManagerMembership(membership.membershipRole);
  const canEditCandidateData = canEditWorkspaceCandidate(
    currentCandidate.hrId,
    session.user.id,
    membership.membershipRole,
    session.user.role,
  );

  if (isManagerSession) {
    const disallowedKeys = submittedKeys.filter(
      (key) => !managerEditableKeys.has(key),
    );
    if (disallowedKeys.length) {
      return NextResponse.json(
        {
          error: "Tài khoản Quản lý chỉ được đánh giá và chốt kết quả nhân sự.",
        },
        { status: 403 },
      );
    }
  } else if (
    submittedKeys.length &&
    !canEditCandidateData &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: "HR chỉ được cập nhật các CV do mình phụ trách." },
      { status: 403 },
    );
  }

  const hasManagerReviewUpdate = submittedKeys.some((key) =>
    ["managerDecision", "managerOfferSalary", "managerReviewNote"].includes(
      key,
    ),
  );
  const currentStatus = normalizeCandidateStatus(currentCandidate.status);
  if (
    hasManagerReviewUpdate &&
    (membership.membershipRole !== "MANAGER" || currentStatus !== "OFFER")
  ) {
    return NextResponse.json(
      {
        error:
          "Chỉ tài khoản Sếp mới được đánh giá khi CV đang ở trạng thái Offer.",
      },
      { status: 403 },
    );
  }

  const nextStatus = parsed.data.status;
  const resolvedStatus = nextStatus ?? currentStatus;
  const nextInterviewDate =
    parsed.data.interviewDate ?? currentCandidate.interviewDate ?? "";
  const nextInterviewerName =
    parsed.data.interviewerName ?? currentCandidate.interviewerName ?? "";
  const nextNoHireReason =
    parsed.data.noHireReason !== undefined
      ? parsed.data.noHireReason.trim()
      : (currentCandidate.noHireReason ?? "");

  if (
    requiresInterviewDetails(resolvedStatus) &&
    (!nextInterviewDate.trim() || !nextInterviewerName.trim())
  ) {
    return NextResponse.json(
      {
        error:
          "Khi chuyển sang trạng thái phỏng vấn, cần nhập ngày phỏng vấn và người phỏng vấn.",
      },
      { status: 400 },
    );
  }

  if (resolvedStatus === "NO_HIRE" && !nextNoHireReason) {
    return NextResponse.json(
      { error: "Cần chọn lý do không tuyển khi chuyển ứng viên sang Không tuyển." },
      { status: 400 },
    );
  }

  let projectId = currentCandidate.projectId;
  if (parsed.data.projectId !== undefined) {
    try {
      projectId = await ensureProjectInWorkspace(
        parsed.data.projectId,
        currentCandidate.workspaceId,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Dự án đã chọn không thuộc workspace này." },
          { status: 400 },
        );
      }
      throw error;
    }
  }

  let hrId = currentCandidate.hrId;
  if (parsed.data.hrId !== undefined) {
    const isChangingHr = parsed.data.hrId !== currentCandidate.hrId;

    if (
      isChangingHr &&
      !canAssignCandidateToHr(
        parsed.data.hrId,
        session.user.id,
        membership.membershipRole,
        session.user.role,
      )
    ) {
      return NextResponse.json(
        { error: "HR chỉ được nhận CV của chính mình." },
        { status: 403 },
      );
    }

    try {
      hrId = await ensureAssignableHr(
        currentCandidate.workspaceId,
        parsed.data.hrId,
      );
    } catch {
      return NextResponse.json(
        { error: "Người phụ trách phải là HR hoặc HR Admin trong workspace." },
        { status: 400 },
      );
    }
  }

  const nextEmail =
    parsed.data.email === undefined ? undefined : parsed.data.email.trim();
  const emailForUpdate =
    nextEmail === undefined ? undefined : nextEmail || null;
  if (
    nextEmail &&
    !isManagerSession &&
    hasValueChanged(currentCandidate.email, nextEmail)
  ) {
    const duplicateEmail = await findDuplicateCandidateEmail(
      nextEmail,
      candidateId,
    );

    if (duplicateEmail.length) {
      return NextResponse.json(
        {
          error: `Email ${nextEmail} đã tồn tại trong database${duplicateEmail[0].fullName ? ` cho ứng viên ${duplicateEmail[0].fullName}` : ""}. Không thể cập nhật sang email này.`,
        },
        { status: 409 },
      );
    }
  }

  const managerDecisionValue =
    parsed.data.managerDecision === undefined
      ? undefined
      : parsed.data.managerDecision === ""
        ? "PENDING"
        : parsed.data.managerDecision;
  const nextDateOfBirth =
    parsed.data.dateOfBirth !== undefined
      ? toBirthYear(parsed.data.dateOfBirth)
      : undefined;
  const nextSkillsJson =
    parsed.data.skills !== undefined
      ? stringifySkills(parsed.data.skills)
      : undefined;

  const historyChanges: string[] = [];

  if (!isManagerSession) {
    appendChange(
      historyChanges,
      "Họ và tên",
      currentCandidate.fullName,
      parsed.data.fullName,
    );
    appendChange(historyChanges, "Email", currentCandidate.email, nextEmail);
    appendChange(
      historyChanges,
      "Số điện thoại",
      currentCandidate.phone,
      parsed.data.phone,
    );
    appendChange(
      historyChanges,
      "Năm sinh",
      currentCandidate.dateOfBirth,
      nextDateOfBirth,
    );
    appendChange(
      historyChanges,
      "Địa chỉ",
      currentCandidate.address,
      parsed.data.address,
    );
    appendChange(
      historyChanges,
      "Quê quán",
      currentCandidate.hometown,
      parsed.data.hometown,
    );
    appendChange(
      historyChanges,
      "Trường học",
      currentCandidate.school,
      parsed.data.school,
    );
    appendChange(
      historyChanges,
      "Năm tốt nghiệp",
      currentCandidate.graduationYear,
      parsed.data.graduationYear,
    );
    appendChange(
      historyChanges,
      "Số năm kinh nghiệm",
      currentCandidate.yearsOfExperience,
      parsed.data.yearsOfExperience,
    );
    appendChange(
      historyChanges,
      "Kỹ năng chính",
      currentCandidate.skillsJson,
      nextSkillsJson,
    );
    appendChange(
      historyChanges,
      "Tóm tắt ứng viên",
      currentCandidate.summary,
      parsed.data.summary,
    );
    appendChange(
      historyChanges,
      "Vị trí ứng tuyển",
      currentCandidate.position,
      parsed.data.position,
    );
    appendChange(
      historyChanges,
      "Nguồn",
      currentCandidate.source,
      parsed.data.source,
    );
    appendChange(
      historyChanges,
      "Mức lương mong muốn",
      currentCandidate.expectedSalary,
      parsed.data.expectedSalary,
    );
    appendChange(
      historyChanges,
      "Mức offer nội bộ",
      currentCandidate.offerSalary,
      parsed.data.offerSalary,
    );
    appendChange(
      historyChanges,
      "Ghi chú nội bộ",
      currentCandidate.notes,
      parsed.data.notes,
    );
    appendChange(
      historyChanges,
      "Ngày phỏng vấn",
      currentCandidate.interviewDate,
      parsed.data.interviewDate,
    );
    appendChange(
      historyChanges,
      "Người phỏng vấn",
      currentCandidate.interviewerName,
      parsed.data.interviewerName,
    );
    appendChange(
      historyChanges,
      "Nhận xét phỏng vấn",
      currentCandidate.interviewFeedback,
      parsed.data.interviewFeedback,
    );
    appendChange(
      historyChanges,
      "HR phụ trách",
      currentCandidate.hrId,
      parsed.data.hrId !== undefined ? hrId : undefined,
    );
    appendChange(
      historyChanges,
      "Dự án",
      currentCandidate.projectId,
      parsed.data.projectId !== undefined ? projectId : undefined,
    );
  }

  appendChange(
    historyChanges,
    "Trạng thái",
    currentStatus,
    nextStatus,
  );
  appendChange(
    historyChanges,
    "Lý do không tuyển",
    currentCandidate.noHireReason,
    resolvedStatus === "NO_HIRE" ? nextNoHireReason : null,
  );

  if (hasManagerReviewUpdate) {
    appendChange(
      historyChanges,
      "Quyết định quản lý",
      currentCandidate.managerDecision,
      managerDecisionValue,
    );
    appendChange(
      historyChanges,
      "Offer sếp đề xuất",
      currentCandidate.managerOfferSalary,
      parsed.data.managerOfferSalary,
    );
    appendChange(
      historyChanges,
      "Nhận xét duyệt tuyển",
      currentCandidate.managerReviewNote,
      parsed.data.managerReviewNote,
    );
  }

  const updatedCandidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      ...(isManagerSession
        ? {
            status: nextStatus ?? undefined,
            noHireReason:
              nextStatus !== undefined
                ? resolvedStatus === "NO_HIRE"
                  ? nextNoHireReason
                  : null
                : undefined,
          }
        : {
            fullName: parsed.data.fullName,
            email: emailForUpdate,
            phone: parsed.data.phone,
            dateOfBirth: nextDateOfBirth,
            address: parsed.data.address,
            hometown: parsed.data.hometown,
            school: parsed.data.school,
            graduationYear: parsed.data.graduationYear,
            yearsOfExperience: parsed.data.yearsOfExperience,
            summary: parsed.data.summary,
            position: parsed.data.position,
            source: parsed.data.source,
            expectedSalary: parsed.data.expectedSalary,
            offerSalary: parsed.data.offerSalary,
            notes: parsed.data.notes,
            interviewDate: parsed.data.interviewDate,
            interviewerName: parsed.data.interviewerName,
            interviewFeedback: parsed.data.interviewFeedback,
            hrId,
            projectId,
            skillsJson: nextSkillsJson,
            status: nextStatus ?? undefined,
            noHireReason:
              nextStatus !== undefined ||
              parsed.data.noHireReason !== undefined
                ? resolvedStatus === "NO_HIRE"
                  ? nextNoHireReason
                  : null
                : undefined,
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

  if (historyChanges.length) {
    const noteParts = [
      parsed.data.statusNote?.trim(),
      `Cập nhật: ${historyChanges.join("; ")}`,
    ].filter(Boolean);

    await prisma.statusHistory.create({
      data: {
        candidateId,
        fromStatus:
          nextStatus && nextStatus !== currentStatus
            ? currentStatus
            : currentStatus,
        toStatus: nextStatus ?? currentStatus,
        changedBy: session.user.id,
        note: noteParts.join("\n") || null,
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
    permission = await canManageCandidate(
      candidateId,
      session.user.id,
      session.user.role,
    );
    await requireWorkspaceHrAdmin(
      permission.candidate.workspaceId,
      session.user.id,
      session.user.role,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "NOT_FOUND"
            ? "Không tìm thấy ứng viên."
            : "Bạn không có quyền xóa ứng viên này.",
      },
      {
        status:
          error instanceof Error && error.message === "NOT_FOUND" ? 404 : 403,
      },
    );
  }

  await prisma.candidate.delete({
    where: { id: candidateId },
  });

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  canAssignCandidateToHr,
  requireWorkspaceAccess,
  requireWorkspaceHrActor,
} from "@/lib/permissions";
import { extractTextFromFile } from "@/lib/parser/extract-text";
import { saveUploadedFile } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { stringifySkills } from "@/lib/utils";

function parseIntOrNull(value: FormDataEntryValue | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "`workspaceId` là bắt buộc." }, { status: 400 });
  }

  try {
    await requireWorkspaceAccess(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền truy cập workspace này." }, { status: 403 });
  }

  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status")?.trim();
  const hrId = searchParams.get("hrId")?.trim();
  const position = searchParams.get("position")?.trim();
  const projectId = searchParams.get("projectId")?.trim();

  const candidates = await prisma.candidate.findMany({
    where: {
      workspaceId,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { position: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(hrId ? { hrId } : {}),
      ...(position ? { position: { contains: position } } : {}),
      ...(projectId ? { projectId } : {}),
    },
    include: {
      hr: true,
      project: true,
      managerReviewedBy: true,
      cvFile: true,
      statusHistory: {
        orderBy: { changedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(candidates);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const formData = await request.formData();
  const workspaceId = String(formData.get("workspaceId") ?? "");

  if (!workspaceId) {
    return NextResponse.json({ error: "`workspaceId` là bắt buộc." }, { status: 400 });
  }

  let membership;
  try {
    membership = await requireWorkspaceHrActor(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền tạo hồ sơ trong workspace này." }, { status: 403 });
  }

  const file = formData.get("file");
  let cvFileId: string | null = null;

  if (file instanceof File) {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File vượt quá giới hạn 10MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await saveUploadedFile(workspaceId, file.name, buffer);
    const rawText = await extractTextFromFile(file.name, buffer, file.type);

    const cvFile = await prisma.cVFile.create({
      data: {
        workspaceId,
        uploadedBy: session.user.id,
        fileName: file.name,
        filePath,
        mimeType: file.type,
        fileSize: file.size,
        rawText,
      },
    });

    cvFileId = cvFile.id;
  }

  const skills = String(formData.get("skills") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const status = String(formData.get("status") ?? "NEW");
  const requestedHrId = String(formData.get("hrId") ?? session.user.id).trim() || session.user.id;
  const interviewDate = String(formData.get("interviewDate") ?? "").trim();
  const interviewerName = String(formData.get("interviewerName") ?? "").trim();
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();

  if (!canAssignCandidateToHr(requestedHrId, session.user.id, membership.membershipRole, session.user.role)) {
    return NextResponse.json({ error: "HR chỉ được tạo và nhận CV của chính mình." }, { status: 403 });
  }

  let hrId: string;
  try {
    hrId = await ensureAssignableHr(workspaceId, requestedHrId);
  } catch {
    return NextResponse.json({ error: "Người phụ trách phải là HR hoặc HR Admin trong workspace." }, { status: 400 });
  }

  if (requiresInterviewDetails(status) && (!interviewDate || !interviewerName)) {
    return NextResponse.json(
      { error: "Khi tạo ứng viên ở trạng thái phỏng vấn, cần nhập ngày phỏng vấn và người phỏng vấn." },
      { status: 400 },
    );
  }

  let projectId: string | null = null;
  try {
    projectId = await ensureProjectInWorkspace(projectIdRaw || null, workspaceId);
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Dự án đã chọn không thuộc workspace này." }, { status: 400 });
    }
    throw error;
  }

  const candidate = await prisma.candidate.create({
    data: {
      workspaceId,
      hrId,
      cvFileId,
      projectId,
      fullName: String(formData.get("fullName") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      dateOfBirth: String(formData.get("dateOfBirth") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      hometown: String(formData.get("hometown") ?? "") || null,
      school: String(formData.get("school") ?? "") || null,
      graduationYear: String(formData.get("graduationYear") ?? "") || null,
      yearsOfExperience: parseIntOrNull(formData.get("yearsOfExperience")),
      skillsJson: stringifySkills(skills),
      summary: String(formData.get("summary") ?? "") || null,
      position: String(formData.get("position") ?? "") || null,
      source: String(formData.get("source") ?? "") || null,
      offerSalary: String(formData.get("offerSalary") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      interviewDate: interviewDate || null,
      interviewerName: interviewerName || null,
      interviewFeedback: String(formData.get("interviewFeedback") ?? "") || null,
      managerDecision: "PENDING",
      status,
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: status,
          changedBy: session.user.id,
          note: "Tạo hồ sơ ứng viên",
        },
      },
    },
  });

  return NextResponse.json(candidate, { status: 201 });
}

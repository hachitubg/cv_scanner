import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const projectUpdateSchema = z.object({
  name: z.string().trim().min(2, "Tên dự án phải có ít nhất 2 ký tự."),
  description: z.string().trim().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId, projectId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền cập nhật dự án trong workspace này." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = projectUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án." }, { status: 404 });
  }

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });

  return NextResponse.json(updatedProject);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ workspaceId: string; projectId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId, projectId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền xóa dự án trong workspace này." }, { status: 403 });
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án." }, { status: 404 });
  }

  await prisma.project.delete({
    where: { id: projectId },
  });

  return NextResponse.json({ success: true });
}

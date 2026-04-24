import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireWorkspaceAccess, requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Tên dự án phải có ít nhất 2 ký tự."),
  description: z.string().trim().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền xem dự án của workspace này." }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền tạo dự án trong workspace này." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = projectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Tên dự án đã tồn tại trong workspace." }, { status: 400 });
    }
    throw error;
  }
}

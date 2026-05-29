import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  requireWorkspaceAccess,
  requireWorkspaceHrActor,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const todoSchema = z.object({
  title: z.string().trim().min(2, "Tên việc cần làm phải có ít nhất 2 ký tự."),
  description: z.string().trim().optional(),
});

export async function GET(
  _: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền xem to-do list của workspace này." },
      { status: 403 },
    );
  }

  const todos = await prisma.workspaceTodo.findMany({
    where: { workspaceId },
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(todos);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceHrActor(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền tạo to-do list trong workspace này." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = todoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const todo = await prisma.workspaceTodo.create({
    data: {
      workspaceId,
      title: parsed.data.title,
      description: parsed.data.description || null,
    },
  });

  return NextResponse.json(todo, { status: 201 });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireWorkspaceHrActor } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const todoUpdateSchema = z
  .object({
    title: z.string().trim().min(2, "Tên việc cần làm phải có ít nhất 2 ký tự.").optional(),
    description: z.string().trim().optional(),
    assignedToId: z.string().trim().nullable().optional(),
    workDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Vui lòng chọn ngày hợp lệ.").optional(),
    workMonth: z.string().trim().regex(/^\d{4}-\d{2}$/, "Vui lòng chọn tháng hợp lệ.").optional(),
    workWeek: z.coerce.number().int().min(1, "Vui lòng chọn tuần hợp lệ.").max(6, "Vui lòng chọn tuần hợp lệ.").optional(),
    done: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Không có dữ liệu cần cập nhật.",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; todoId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId, todoId } = await params;

  try {
    await requireWorkspaceHrActor(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền cập nhật to-do list trong workspace này." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = todoUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const todo = await prisma.workspaceTodo.findFirst({
    where: { id: todoId, workspaceId },
  });

  if (!todo) {
    return NextResponse.json(
      { error: "Không tìm thấy to-do." },
      { status: 404 },
    );
  }

  if (parsed.data.assignedToId) {
    const assignee = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: parsed.data.assignedToId,
        role: { not: "MANAGER" },
      },
    });

    if (!assignee) {
      return NextResponse.json(
        { error: "HR được phân công không thuộc workspace này." },
        { status: 400 },
      );
    }
  }

  const updatedTodo = await prisma.workspaceTodo.update({
    where: { id: todoId },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description || null }
        : {}),
      ...(parsed.data.assignedToId !== undefined
        ? { assignedToId: parsed.data.assignedToId || null }
        : {}),
      ...(parsed.data.workDate !== undefined ? { workDate: parsed.data.workDate } : {}),
      ...(parsed.data.workMonth !== undefined ? { workMonth: parsed.data.workMonth } : {}),
      ...(parsed.data.workWeek !== undefined ? { workWeek: parsed.data.workWeek } : {}),
      ...(parsed.data.done !== undefined ? { done: parsed.data.done } : {}),
    },
  });

  return NextResponse.json(updatedTodo);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ workspaceId: string; todoId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId, todoId } = await params;

  try {
    await requireWorkspaceHrActor(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền xóa to-do list trong workspace này." },
      { status: 403 },
    );
  }

  const todo = await prisma.workspaceTodo.findFirst({
    where: { id: todoId, workspaceId },
  });

  if (!todo) {
    return NextResponse.json(
      { error: "Không tìm thấy to-do." },
      { status: 404 },
    );
  }

  await prisma.workspaceTodo.delete({
    where: { id: todoId },
  });

  return NextResponse.json({ success: true });
}

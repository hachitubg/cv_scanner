import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_DROPDOWN_TYPES } from "@/types";

const optionUpdateSchema = z.object({
  type: z.enum(WORKSPACE_DROPDOWN_TYPES).optional(),
  name: z.string().trim().min(2, "Tên cấu hình phải có ít nhất 2 ký tự."),
  description: z.string().trim().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; optionId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId, optionId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền cập nhật cấu hình trong workspace này." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = optionUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const option = await prisma.workspaceDropdownOption.findFirst({
    where: { id: optionId, workspaceId },
  });

  if (!option) {
    return NextResponse.json(
      { error: "Không tìm thấy cấu hình." },
      { status: 404 },
    );
  }

  try {
    const updatedOption = await prisma.workspaceDropdownOption.update({
      where: { id: optionId },
      data: {
        type: parsed.data.type ?? option.type,
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });

    return NextResponse.json(updatedOption);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Tên cấu hình này đã tồn tại trong nhóm đang chọn." },
        { status: 400 },
      );
    }

    throw error;
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ workspaceId: string; optionId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId, optionId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền xóa cấu hình trong workspace này." },
      { status: 403 },
    );
  }

  const option = await prisma.workspaceDropdownOption.findFirst({
    where: { id: optionId, workspaceId },
  });

  if (!option) {
    return NextResponse.json(
      { error: "Không tìm thấy cấu hình." },
      { status: 404 },
    );
  }

  await prisma.workspaceDropdownOption.delete({
    where: { id: optionId },
  });

  return NextResponse.json({ success: true });
}

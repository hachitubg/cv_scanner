import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  requireWorkspaceAccess,
  requireWorkspaceHrAdmin,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  WORKSPACE_DROPDOWN_TYPES,
  type WorkspaceDropdownType,
} from "@/types";

const optionSchema = z.object({
  type: z.enum(WORKSPACE_DROPDOWN_TYPES),
  name: z.string().trim().min(2, "Tên cấu hình phải có ít nhất 2 ký tự."),
  description: z.string().trim().optional(),
});

function isDropdownType(value: string | null): value is WorkspaceDropdownType {
  return WORKSPACE_DROPDOWN_TYPES.includes(
    value as (typeof WORKSPACE_DROPDOWN_TYPES)[number],
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId } = await params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  try {
    await requireWorkspaceAccess(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền xem cấu hình của workspace này." },
      { status: 403 },
    );
  }

  const options = await prisma.workspaceDropdownOption.findMany({
    where: {
      workspaceId,
      ...(isDropdownType(type) ? { type } : {}),
    },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(options);
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
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền tạo cấu hình trong workspace này." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = optionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const option = await prisma.workspaceDropdownOption.create({
      data: {
        workspaceId,
        type: parsed.data.type,
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });

    return NextResponse.json(option, { status: 201 });
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

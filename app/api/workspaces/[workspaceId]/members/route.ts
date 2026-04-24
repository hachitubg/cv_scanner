import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const inviteMemberSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ."),
  role: z.enum(["HR", "HR_ADMIN", "MANAGER"]).default("HR"),
});

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền quản lý thành viên trong workspace này." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Không tìm thấy tài khoản với email này. Người dùng cần tự đăng ký trước." },
      { status: 404 },
    );
  }

  if (!user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Tài khoản này chưa xác minh email. Hãy yêu cầu người dùng xác minh trước khi thêm vào workspace." },
      { status: 400 },
    );
  }

  const membership = await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id,
      },
    },
    update: {
      role: parsed.data.role,
    },
    create: {
      workspaceId,
      userId: user.id,
      role: parsed.data.role,
    },
    include: {
      user: true,
    },
  });

  return NextResponse.json(membership);
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_ROLES } from "@/types";

const updateMemberRoleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId, userId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json(
      { error: "Bạn không có quyền sửa role thành viên trong workspace này." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = updateMemberRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const targetMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Không tìm thấy thành viên." }, { status: 404 });
  }

  if (targetMembership.role === parsed.data.role) {
    const currentMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        user: true,
      },
    });

    return NextResponse.json(currentMembership);
  }

  if (targetMembership.role === "HR_ADMIN" && parsed.data.role !== "HR_ADMIN") {
    const hrAdminCount = await prisma.workspaceMember.count({
      where: {
        workspaceId,
        role: "HR_ADMIN",
      },
    });

    if (hrAdminCount <= 1) {
      return NextResponse.json(
        { error: "Workspace phải còn ít nhất 1 HR Admin." },
        { status: 400 },
      );
    }
  }

  const updatedMembership = await prisma.workspaceMember.update({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    data: {
      role: parsed.data.role,
    },
    include: {
      user: true,
    },
  });

  return NextResponse.json(updatedMembership);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId, userId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);

    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: "Không tìm thấy thành viên." }, { status: 404 });
    }

    if (targetMembership.role === "HR_ADMIN") {
      const hrAdminCount = await prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: "HR_ADMIN",
        },
      });

      if (hrAdminCount <= 1) {
        return NextResponse.json({ error: "Workspace phải còn ít nhất 1 HR Admin." }, { status: 400 });
      }
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền xóa thành viên trong workspace này." }, { status: 403 });
  }
}

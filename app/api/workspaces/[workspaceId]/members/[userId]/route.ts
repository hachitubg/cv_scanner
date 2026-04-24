import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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

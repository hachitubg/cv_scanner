import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { requireWorkspaceAccess, requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền xem workspace này." }, { status: 403 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: true,
      members: {
        include: {
          user: true,
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
      candidates: {
        include: {
          hr: true,
        },
        orderBy: { createdAt: "desc" },
      },
      cvFiles: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Không tìm thấy workspace." }, { status: 404 });
  }

  return NextResponse.json(workspace);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceHrAdmin(workspaceId, session.user.id, session.user.role);
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền xóa workspace này." }, { status: 403 });
  }

  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  return NextResponse.json({ success: true });
}

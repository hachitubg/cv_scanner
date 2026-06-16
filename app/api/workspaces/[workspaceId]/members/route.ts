import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireWorkspaceHrAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { issueWorkspaceInvitation } from "@/lib/workspace-invitations";
import { WORKSPACE_ROLES } from "@/types";

const inviteMemberSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ."),
  role: z.enum(WORKSPACE_ROLES).default("HR"),
});

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

  const invitedEmail = parsed.data.email.toLowerCase();
  const existingMembership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      user: {
        email: invitedEmail,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingMembership) {
    return NextResponse.json(
      { error: "Email này đã là thành viên của workspace." },
      { status: 409 },
    );
  }

  try {
    const delivery = await issueWorkspaceInvitation({
      workspaceId,
      invitedEmail,
      role: parsed.data.role,
      invitedById: session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        invitationId: delivery.invitation.id,
        emailSent: delivery.delivered,
        previewUrl: delivery.previewUrl || delivery.invitationUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Issue workspace invitation failed:", error);
    return NextResponse.json(
      { error: "Không thể gửi lời mời workspace." },
      { status: 500 },
    );
  }
}

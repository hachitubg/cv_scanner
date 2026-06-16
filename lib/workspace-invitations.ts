import crypto from "node:crypto";

import { getPublicAppUrl, sendWorkspaceInvitationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { workspaceRoleMeta } from "@/lib/utils";
import type { WorkspaceRoleType } from "@/types";

const WORKSPACE_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashInvitationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createInvitationToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  return {
    rawToken,
    tokenHash: hashInvitationToken(rawToken),
    expiresAt: new Date(Date.now() + WORKSPACE_INVITATION_TTL_MS),
  };
}

export async function issueWorkspaceInvitation(params: {
  workspaceId: string;
  invitedEmail: string;
  role: WorkspaceRoleType;
  invitedById: string;
}) {
  const invitedEmail = params.invitedEmail.trim().toLowerCase();
  const { rawToken, tokenHash, expiresAt } = createInvitationToken();

  const [workspace, inviter, existingUser] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: params.workspaceId },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: params.invitedById },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { email: invitedEmail },
      select: { id: true, name: true, email: true },
    }),
  ]);

  if (!workspace || !inviter) {
    throw new Error("INVITATION_CONTEXT_NOT_FOUND");
  }

  await prisma.workspaceInvitation.updateMany({
    where: {
      workspaceId: params.workspaceId,
      invitedEmail,
      acceptedAt: null,
    },
    data: {
      expiresAt: new Date(0),
    },
  });

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: params.workspaceId,
      invitedEmail,
      role: params.role,
      tokenHash,
      invitedById: params.invitedById,
      expiresAt,
    },
  });

  const invitationUrl = `${getPublicAppUrl()}/workspace-invitations/accept?token=${rawToken}`;
  const delivery = await sendWorkspaceInvitationEmail({
    toEmail: invitedEmail,
    toName: existingUser?.name || invitedEmail,
    workspaceName: workspace.name,
    invitedByName: inviter.name,
    roleLabel: workspaceRoleMeta[params.role],
    invitationUrl,
  });

  return {
    invitation,
    invitationUrl,
    ...delivery,
  };
}

export async function acceptWorkspaceInvitation(params: {
  rawToken: string;
  userId: string;
  userEmail: string;
}) {
  const tokenHash = hashInvitationToken(params.rawToken);

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash },
    include: {
      workspace: true,
    },
  });

  if (!invitation) {
    return { status: "invalid" as const };
  }

  if (invitation.acceptedAt) {
    return {
      status: "already_accepted" as const,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace.name,
    };
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    return { status: "expired" as const };
  }

  if (invitation.invitedEmail !== params.userEmail.trim().toLowerCase()) {
    return {
      status: "wrong_user" as const,
      invitedEmail: invitation.invitedEmail,
    };
  }

  const membership = await prisma.$transaction(async (tx) => {
    const createdMembership = await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: params.userId,
        },
      },
      update: {
        role: invitation.role,
      },
      create: {
        workspaceId: invitation.workspaceId,
        userId: params.userId,
        role: invitation.role,
      },
    });

    await tx.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return createdMembership;
  });

  return {
    status: "accepted" as const,
    workspaceId: membership.workspaceId,
    workspaceName: invitation.workspace.name,
  };
}

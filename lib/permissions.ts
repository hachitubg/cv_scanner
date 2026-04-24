import { prisma } from "@/lib/prisma";
import type { CandidateStatusType, RoleType, WorkspaceRoleType } from "@/types";

export const MANAGER_ALLOWED_FINAL_STATUSES: CandidateStatusType[] = [
  "OFFERED",
  "OFFER_DECLINED",
  "ONBOARDED",
  "REJECTED",
];

export function isManagerMembership(role?: WorkspaceRoleType) {
  return role === "MANAGER";
}

export function isHrMembership(role?: WorkspaceRoleType) {
  return role === "HR";
}

export function isHrAdminMembership(role?: WorkspaceRoleType) {
  return role === "HR_ADMIN";
}

export function isWorkspaceHrActor(role?: WorkspaceRoleType) {
  return role === "HR_ADMIN" || role === "HR";
}

export function isWorkspaceManagerOrAdmin(membershipRole: WorkspaceRoleType, role: RoleType) {
  return role === "ADMIN" || membershipRole === "MANAGER" || membershipRole === "HR_ADMIN";
}

export function canEditWorkspaceCandidate(
  candidateHrId: string,
  userId: string,
  membershipRole: WorkspaceRoleType,
  role: RoleType,
) {
  return role === "ADMIN" || membershipRole === "HR_ADMIN" || (membershipRole === "HR" && candidateHrId === userId);
}

export function canAssignCandidateToHr(
  targetHrId: string,
  userId: string,
  membershipRole: WorkspaceRoleType,
  role: RoleType,
) {
  return role === "ADMIN" || membershipRole === "HR_ADMIN" || (membershipRole === "HR" && targetHrId === userId);
}

export function canManagerUpdateCandidateStatus(
  nextStatus: string | undefined,
  membershipRole: WorkspaceRoleType,
  role: RoleType,
) {
  if (!nextStatus) return true;
  if (role === "ADMIN" || membershipRole === "HR_ADMIN") return true;
  if (membershipRole !== "MANAGER") return false;
  return MANAGER_ALLOWED_FINAL_STATUSES.includes(nextStatus as CandidateStatusType);
}

export async function getWorkspaceMembership(workspaceId: string, userId: string, role: RoleType) {
  if (role === "ADMIN") {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: true,
      },
    });
    if (!workspace) return null;
    return {
      workspace,
      membershipRole: "HR_ADMIN" as WorkspaceRoleType,
    };
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: {
        include: {
          owner: true,
        },
      },
    },
  });

  if (!membership) return null;
  return {
    workspace: membership.workspace,
    membershipRole: membership.role as WorkspaceRoleType,
  };
}

export async function requireWorkspaceAccess(workspaceId: string, userId: string, role: RoleType) {
  const membership = await getWorkspaceMembership(workspaceId, userId, role);
  if (!membership) {
    throw new Error("FORBIDDEN");
  }
  return membership;
}

export async function requireWorkspaceHrActor(workspaceId: string, userId: string, role: RoleType) {
  const membership = await requireWorkspaceAccess(workspaceId, userId, role);
  if (role !== "ADMIN" && !isWorkspaceHrActor(membership.membershipRole)) {
    throw new Error("FORBIDDEN");
  }
  return membership;
}

export async function requireWorkspaceHrAdmin(workspaceId: string, userId: string, role: RoleType) {
  const membership = await requireWorkspaceAccess(workspaceId, userId, role);
  if (role !== "ADMIN" && membership.membershipRole !== "HR_ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return membership;
}

export async function canManageCandidate(candidateId: string, userId: string, role: RoleType) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      workspace: true,
    },
  });

  if (!candidate) {
    throw new Error("NOT_FOUND");
  }

  const membership = await requireWorkspaceAccess(candidate.workspaceId, userId, role);
  return { candidate, membership };
}

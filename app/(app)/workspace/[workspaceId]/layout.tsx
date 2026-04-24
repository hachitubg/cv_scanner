import { notFound, redirect } from "next/navigation";

import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { auth } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { workspaceId } = await params;

  let membership: Awaited<ReturnType<typeof requireWorkspaceAccess>> | null = null;
  try {
    membership = await requireWorkspaceAccess(workspaceId, session.user.id, session.user.role);
  } catch {
    notFound();
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    notFound();
  }

  return (
    <>
      <WorkspaceSidebar
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        userName={session.user.name}
        userEmail={session.user.email}
        membershipRole={membership!.membershipRole}
      />
      <div className="page-shell">{children}</div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/layout/auth-shell";
import { auth } from "@/lib/auth";
import { acceptWorkspaceInvitation } from "@/lib/workspace-invitations";

export default async function AcceptWorkspaceInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const session = await auth();

  if (!token) {
    return (
      <InvitationResult
        title="Lời mời không hợp lệ"
        description="Đường dẫn lời mời không tồn tại hoặc thiếu mã xác thực."
      />
    );
  }

  if (!session?.user) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/workspace-invitations/accept?token=${token}`)}`,
    );
  }

  const result = await acceptWorkspaceInvitation({
    rawToken: token,
    userId: session.user.id,
    userEmail: session.user.email ?? "",
  });

  if (result.status === "accepted" || result.status === "already_accepted") {
    return (
      <InvitationResult
        title={
          result.status === "accepted"
            ? "Đã tham gia workspace"
            : "Bạn đã tham gia workspace này"
        }
        description={`Bạn có thể mở workspace ${result.workspaceName} để bắt đầu làm việc.`}
        workspaceId={result.workspaceId}
      />
    );
  }

  if (result.status === "wrong_user") {
    return (
      <InvitationResult
        title="Email đăng nhập chưa đúng"
        description={`Lời mời này được gửi tới ${result.invitedEmail}. Hãy đăng xuất và đăng nhập bằng đúng email được mời.`}
      />
    );
  }

  if (result.status === "expired") {
    return (
      <InvitationResult
        title="Lời mời đã hết hạn"
        description="Hãy liên hệ HR Admin để gửi lại lời mời workspace mới."
      />
    );
  }

  return (
    <InvitationResult
      title="Lời mời không hợp lệ"
      description="Lời mời không tồn tại hoặc đã bị thay thế bằng lời mời mới hơn."
    />
  );
}

function InvitationResult({
  title,
  description,
  workspaceId,
}: {
  title: string;
  description: string;
  workspaceId?: string;
}) {
  return (
    <AuthShell
      title={title}
      description={description}
      asideTitle="Lời mời workspace"
      asideDescription="Thành viên chỉ được thêm vào workspace sau khi xác nhận lời mời qua email."
    >
      <div className="space-y-4 rounded-[2rem] bg-white/90 p-6 shadow-soft">
        <p className="text-sm font-semibold leading-6 text-on-surface-variant">
          {description}
        </p>

        <div className="flex flex-wrap gap-3">
          {workspaceId ? (
            <Link
              href={`/workspace/${workspaceId}/dashboard`}
              className="inline-flex h-12 items-center justify-center rounded-full bg-cta-gradient px-6 text-sm font-extrabold text-white shadow-bubbly transition duration-200 hover:-translate-y-0.5 hover:shadow-ambient"
            >
              Mở workspace
            </Link>
          ) : null}
          <Link
            href="/workspaces"
            className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold text-on-surface transition hover:bg-surface-container-high"
          >
            Về danh sách workspace
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

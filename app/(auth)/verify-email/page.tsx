import Link from "next/link";

import { AuthShell } from "@/components/layout/auth-shell";
import { verifyEmailToken } from "@/lib/email-verification";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const result = token ? await verifyEmailToken(token) : { status: "invalid" as const };

  const titleMap = {
    verified: "Xác minh email thành công",
    already_verified: "Email đã được xác minh",
    expired: "Liên kết đã hết hạn",
    invalid: "Liên kết không hợp lệ",
  } as const;

  const descriptionMap = {
    verified: "Tài khoản của bạn đã được kích hoạt. Bây giờ bạn có thể đăng nhập và tham gia workspace.",
    already_verified: "Email này đã được xác minh trước đó. Bạn có thể đăng nhập bình thường.",
    expired: "Hãy quay lại màn hình đăng nhập để gửi lại email xác minh mới.",
    invalid: "Liên kết xác minh không tồn tại hoặc đã được sử dụng.",
  } as const;

  return (
    <AuthShell
      title={titleMap[result.status]}
      description={descriptionMap[result.status]}
      asideTitle="Luồng đăng ký theo hướng self-register"
      asideDescription="Người dùng tự tạo tài khoản, xác minh email rồi mới được đăng nhập và được thêm vào workspace bằng email."
    >
      <div className="space-y-4 rounded-[2rem] bg-white/90 p-6 shadow-soft">
        <p className="text-sm font-semibold text-on-surface-variant">{descriptionMap[result.status]}</p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-full bg-cta-gradient px-6 text-sm font-extrabold text-white shadow-bubbly transition duration-200 hover:-translate-y-0.5 hover:shadow-ambient"
          >
            Đi tới đăng nhập
          </Link>
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold text-on-surface transition hover:bg-surface-container-high"
          >
            Tạo tài khoản khác
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

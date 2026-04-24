import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { auth } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/workspaces");
  }

  const { callbackUrl } = await searchParams;

  return (
    <AuthShell
      title="Đăng nhập CV Scanner"
      description="Truy cập workspace tuyển dụng để scan CV, lọc ứng viên, theo dõi pipeline và phối hợp đánh giá giữa HR với quản lý."
      asideTitle="Quản lý CV gọn hơn, rõ quyền hơn."
      asideDescription="CV Scanner giúp team tuyển dụng đọc CV từ nhiều định dạng, OCR file scan, dùng AI để trích xuất thông tin, quản lý ứng viên theo dự án và tách rõ thao tác HR với phần review của quản lý."
    >
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}

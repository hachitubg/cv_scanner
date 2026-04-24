import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { auth } from "@/lib/auth";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/workspaces");
  }

  return (
    <AuthShell
      title="Tạo tài khoản tuyển dụng"
      description="Đăng ký tài khoản để tham gia workspace, sau đó HR Admin sẽ phân quyền HR, HR Admin hoặc Manager theo đúng vai trò của bạn."
      asideTitle="Một nền tảng cho toàn bộ vòng đời CV."
      asideDescription="Từ upload CV, parse PDF/DOCX/ảnh, scan AI, gắn dự án, giao HR phụ trách, cập nhật trạng thái đến manager review và chốt kết quả cuối cùng, mọi bước được gom trong một workspace rõ ràng."
    >
      <RegisterForm />
    </AuthShell>
  );
}

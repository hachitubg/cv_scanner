import Link from "next/link";
import { redirect } from "next/navigation";

import { NavIcon } from "@/components/layout/nav-icon";
import { LogoutButton } from "@/components/layout/logout-button";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/workspaces");

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "16px 24px",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(226,232,240,0.9)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NavIcon />
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a03964" }}>
              System Admin
            </div>
            <div style={{ marginTop: 4, fontSize: 22, fontWeight: 900, color: "#111827" }}>Lệ HR - CV Manager Scanner Control Room</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/workspaces" style={{ fontWeight: 800, color: "#475569", textDecoration: "none" }}>
            Về workspace
          </Link>
          <LogoutButton />
        </div>
      </div>
      {children}
    </main>
  );
}

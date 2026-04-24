"use client";

import dynamic from "next/dynamic";

const SystemAdminApp = dynamic(
  () => import("@/components/admin/system-admin-app").then((module) => module.SystemAdminApp),
  {
    ssr: false,
    loading: () => <div style={{ padding: 24, fontWeight: 700 }}>Đang tải admin...</div>,
  },
);

export function SystemAdminLoader() {
  return <SystemAdminApp />;
}

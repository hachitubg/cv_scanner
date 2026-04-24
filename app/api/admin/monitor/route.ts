import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { getAdminMonitor } from "@/lib/system-admin";

export async function GET() {
  await requireAdmin();
  const payload = await getAdminMonitor();
  return NextResponse.json(payload);
}

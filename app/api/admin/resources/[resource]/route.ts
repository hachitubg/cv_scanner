import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { writeAppLog } from "@/lib/logs";
import { createAdminResource, listAdminResource } from "@/lib/system-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  await requireAdmin();
  const { resource } = await params;

  try {
    const payload = await listAdminResource(resource, new URL(request.url));
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  const session = await requireAdmin();
  const { resource } = await params;

  try {
    const payload = await createAdminResource(resource, await request.json());
    await writeAppLog("info", "admin.resource.create", "System admin created resource.", {
      adminUserId: session.user.id,
      resource,
      id: (payload as { id?: unknown }).id,
    });
    return NextResponse.json({ data: payload }, { status: 201 });
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    await writeAppLog("warn", "admin.resource.create_failed", "System admin resource create failed.", {
      adminUserId: session.user.id,
      resource,
      error,
    });

    if (error.message === "METHOD_NOT_ALLOWED") {
      return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
    }
    if (error.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "Email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Invalid data." }, { status: 400 });
  }
}

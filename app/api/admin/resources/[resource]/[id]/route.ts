import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { writeAppLog } from "@/lib/logs";
import { deleteAdminResource, getAdminResource, updateAdminResource } from "@/lib/system-admin";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  await requireAdmin();
  const { resource, id } = await params;

  try {
    const payload = await getAdminResource(resource, id);
    return NextResponse.json({ data: payload });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  const session = await requireAdmin();
  const { resource, id } = await params;

  try {
    const payload = await updateAdminResource(resource, id, await request.json(), session.user.id);
    await writeAppLog("info", "admin.resource.update", "System admin updated resource.", {
      adminUserId: session.user.id,
      resource,
      id,
    });
    return NextResponse.json({ data: payload });
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    await writeAppLog("warn", "admin.resource.update_failed", "System admin resource update failed.", {
      adminUserId: session.user.id,
      resource,
      id,
      error,
    });

    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }
    if (error.message === "METHOD_NOT_ALLOWED") {
      return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
    }
    if (error.message === "LAST_ADMIN") {
      return NextResponse.json({ error: "Cannot remove or demote the last system admin." }, { status: 400 });
    }
    if (error.message === "CANNOT_DEMOTE_SELF") {
      return NextResponse.json({ error: "Cannot demote the current admin session." }, { status: 400 });
    }
    if (error.message === "EMAIL_EXISTS") {
      return NextResponse.json({ error: "Email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Invalid data." }, { status: 400 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  const session = await requireAdmin();
  const { resource, id } = await params;

  try {
    const payload = await deleteAdminResource(resource, id, session.user.id);
    await writeAppLog("info", "admin.resource.delete", "System admin deleted resource.", {
      adminUserId: session.user.id,
      resource,
      id,
    });
    return NextResponse.json({ data: payload });
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    await writeAppLog("warn", "admin.resource.delete_failed", "System admin resource delete failed.", {
      adminUserId: session.user.id,
      resource,
      id,
      error,
    });

    if (error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }
    if (error.message === "LAST_ADMIN") {
      return NextResponse.json({ error: "Cannot delete the last system admin." }, { status: 400 });
    }
    if (error.message === "CANNOT_DELETE_SELF") {
      return NextResponse.json({ error: "Cannot delete the current admin session." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Delete failed." }, { status: 400 });
  }
}

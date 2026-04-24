import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Tên workspace phải có ít nhất 2 ký tự."),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const normalized =
    session.user.role === "ADMIN"
      ? (
          await prisma.workspace.findMany({
            include: {
              owner: true,
              members: true,
              candidates: true,
            },
            orderBy: { createdAt: "desc" },
          })
        ).map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          ownerName: workspace.owner.name,
          createdAt: workspace.createdAt,
          memberCount: workspace.members.length,
          candidateCount: workspace.candidates.length,
          membershipRole: workspace.ownerId === session.user.id ? "HR_ADMIN" : "HR",
        }))
      : (
          await prisma.workspaceMember.findMany({
            where: { userId: session.user.id },
            include: {
              workspace: {
                include: {
                  owner: true,
                  members: true,
                  candidates: true,
                },
              },
            },
            orderBy: { joinedAt: "desc" },
          })
        ).map((entry) => ({
          id: entry.workspace.id,
          name: entry.workspace.name,
          ownerName: entry.workspace.owner.name,
          createdAt: entry.workspace.createdAt,
          memberCount: entry.workspace.members.length,
          candidateCount: entry.workspace.candidates.length,
          membershipRole: entry.role,
        }));

  return NextResponse.json(normalized);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      ownerId: session.user.id,
      members: {
        create: {
          userId: session.user.id,
          role: "HR_ADMIN",
        },
      },
    },
  });

  return NextResponse.json(workspace, { status: 201 });
}

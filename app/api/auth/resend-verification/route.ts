import { NextResponse } from "next/server";
import { z } from "zod";

import { issueEmailVerification } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";

const resendSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ."),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = resendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản với email này." }, { status: 404 });
  }

  if (user.emailVerifiedAt) {
    return NextResponse.json({ error: "Tài khoản này đã xác minh email." }, { status: 400 });
  }

  const delivery = await issueEmailVerification(user);

  return NextResponse.json({
    success: true,
    emailSent: delivery.delivered,
    previewUrl: delivery.previewUrl,
  });
}

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const loginCheckSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ."),
  password: z.string().min(1, "Mật khẩu là bắt buộc."),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginCheckSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      password: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Email hoặc mật khẩu chưa đúng." }, { status: 401 });
  }

  const isValid = await bcrypt.compare(parsed.data.password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: "Email hoặc mật khẩu chưa đúng." }, { status: 401 });
  }

  if (!user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Tài khoản chưa xác minh email.", code: "EMAIL_NOT_VERIFIED" },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true });
}

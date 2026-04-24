import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { issueEmailVerification } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự."),
  email: z.string().trim().email("Email không hợp lệ."),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự."),
  confirmPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const { name, email, password, confirmPassword } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Mật khẩu xác nhận chưa khớp." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      emailVerifiedAt: true,
    },
  });

  if (existingUser?.emailVerifiedAt) {
    return NextResponse.json({ error: "Email này đã được sử dụng." }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          password: hashedPassword,
          role: "USER",
          emailVerifiedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
    : await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          password: hashedPassword,
          role: "USER",
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

  const delivery = await issueEmailVerification(user);

  return NextResponse.json(
    {
      email: user.email,
      requiresEmailVerification: true,
      emailSent: delivery.delivered,
      previewUrl: delivery.previewUrl,
    },
    { status: existingUser ? 200 : 201 },
  );
}

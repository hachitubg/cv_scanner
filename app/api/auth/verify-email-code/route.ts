import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyEmailCode } from "@/lib/email-verification";

const verifyEmailCodeSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ."),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Mã kích hoạt phải gồm 6 số."),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = verifyEmailCodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const result = await verifyEmailCode(parsed.data.email, parsed.data.code);

  if (result.status === "verified" || result.status === "already_verified") {
    return NextResponse.json({
      success: true,
      status: result.status,
      email: result.email,
    });
  }

  if (result.status === "expired") {
    return NextResponse.json(
      { error: "Mã kích hoạt đã hết hạn. Hãy gửi lại mã mới." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "Mã kích hoạt không hợp lệ." },
    { status: 400 },
  );
}

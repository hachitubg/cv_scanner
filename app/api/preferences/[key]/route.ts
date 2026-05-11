import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedPreferenceKeys = new Set(["candidates-table-columns"]);

function isAllowedPreferenceKey(key: string) {
  return allowedPreferenceKeys.has(key);
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { key } = await params;
  if (!isAllowedPreferenceKey(key)) {
    return NextResponse.json({ error: "Invalid preference key." }, { status: 400 });
  }

  const preference = await prisma.userPreference.findUnique({
    where: {
      userId_key: {
        userId: session.user.id,
        key,
      },
    },
  });

  if (!preference) {
    return NextResponse.json({ value: null });
  }

  try {
    return NextResponse.json({ value: JSON.parse(preference.value) });
  } catch {
    return NextResponse.json({ value: null });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { key } = await params;
  if (!isAllowedPreferenceKey(key)) {
    return NextResponse.json({ error: "Invalid preference key." }, { status: 400 });
  }

  const body = (await request.json()) as { value?: unknown };
  const serializedValue = JSON.stringify(body.value ?? null);

  if (serializedValue.length > 20_000) {
    return NextResponse.json({ error: "Preference value is too large." }, { status: 413 });
  }

  await prisma.userPreference.upsert({
    where: {
      userId_key: {
        userId: session.user.id,
        key,
      },
    },
    update: {
      value: serializedValue,
    },
    create: {
      userId: session.user.id,
      key,
      value: serializedValue,
    },
  });

  return NextResponse.json({ success: true });
}

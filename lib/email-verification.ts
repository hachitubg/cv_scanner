import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getPublicAppUrl, sendVerificationEmail } from "@/lib/email";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashVerificationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const verificationCode = crypto.randomInt(100000, 1000000).toString();

  return {
    rawToken,
    verificationCode,
    tokenHash: hashVerificationToken(rawToken),
    codeHash: hashVerificationToken(verificationCode),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  };
}

export async function issueEmailVerification(user: {
  id: string;
  name: string;
  email: string;
}) {
  const { rawToken, verificationCode, tokenHash, codeHash, expiresAt } =
    createVerificationToken();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationTokenHash: `${tokenHash}:${codeHash}`,
      emailVerificationTokenExpiresAt: expiresAt,
    },
  });

  const verificationUrl = `${getPublicAppUrl()}/verify-email?email=${encodeURIComponent(user.email)}`;
  const delivery = await sendVerificationEmail({
    toEmail: user.email,
    toName: user.name,
    verificationUrl,
    verificationCode,
  });

  return {
    expiresAt,
    verificationUrl,
    verificationCode,
    ...delivery,
  };
}

function parseStoredVerificationHash(value?: string | null) {
  if (!value) return { tokenHash: null, codeHash: null };

  const [tokenHash, codeHash] = value.split(":");
  return {
    tokenHash: tokenHash || null,
    codeHash: codeHash || null,
  };
}

export async function verifyEmailToken(rawToken: string) {
  const tokenHash = hashVerificationToken(rawToken);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { emailVerificationTokenHash: tokenHash },
        { emailVerificationTokenHash: { startsWith: `${tokenHash}:` } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      emailVerificationTokenExpiresAt: true,
    },
  });

  if (!user) {
    return { status: "invalid" as const };
  }

  if (user.emailVerifiedAt) {
    return { status: "already_verified" as const, email: user.email };
  }

  if (
    !user.emailVerificationTokenExpiresAt ||
    user.emailVerificationTokenExpiresAt.getTime() < Date.now()
  ) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return { status: "expired" as const, email: user.email };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  return { status: "verified" as const, email: user.email, name: user.name };
}

export async function verifyEmailCode(email: string, code: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return { status: "invalid" as const };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      emailVerificationTokenHash: true,
      emailVerificationTokenExpiresAt: true,
    },
  });

  if (!user) {
    return { status: "invalid" as const };
  }

  if (user.emailVerifiedAt) {
    return { status: "already_verified" as const, email: user.email };
  }

  if (
    !user.emailVerificationTokenExpiresAt ||
    user.emailVerificationTokenExpiresAt.getTime() < Date.now()
  ) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return { status: "expired" as const, email: user.email };
  }

  const { codeHash } = parseStoredVerificationHash(
    user.emailVerificationTokenHash,
  );

  if (!codeHash || codeHash !== hashVerificationToken(normalizedCode)) {
    return { status: "invalid" as const, email: user.email };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  return { status: "verified" as const, email: user.email, name: user.name };
}

import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getPublicAppUrl, sendVerificationEmail } from "@/lib/email";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashVerificationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");

  return {
    rawToken,
    tokenHash: hashVerificationToken(rawToken),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  };
}

export async function issueEmailVerification(user: {
  id: string;
  name: string;
  email: string;
}) {
  const { rawToken, tokenHash, expiresAt } = createVerificationToken();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: expiresAt,
    },
  });

  const verificationUrl = `${getPublicAppUrl()}/verify-email?token=${rawToken}`;
  const delivery = await sendVerificationEmail({
    toEmail: user.email,
    toName: user.name,
    verificationUrl,
  });

  return {
    expiresAt,
    verificationUrl,
    ...delivery,
  };
}

export async function verifyEmailToken(rawToken: string) {
  const tokenHash = hashVerificationToken(rawToken);

  const user = await prisma.user.findUnique({
    where: { emailVerificationTokenHash: tokenHash },
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

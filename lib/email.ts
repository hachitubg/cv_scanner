const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export type SentEmailResult = {
  delivered: boolean;
  previewUrl?: string;
  provider: "brevo" | "console";
};

function getEmailProvider() {
  return process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "console";
}

export function getPublicAppUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function hasBrevoConfig() {
  return (
    getEmailProvider() === "brevo" &&
    Boolean(process.env.BREVO_API_KEY?.trim() && process.env.EMAIL_FROM?.trim())
  );
}

export async function sendVerificationEmail(params: {
  toEmail: string;
  toName: string;
  verificationUrl: string;
}): Promise<SentEmailResult> {
  const previewUrl = params.verificationUrl;

  if (!hasBrevoConfig()) {
    console.info(`[email-preview] verify ${params.toEmail}: ${params.verificationUrl}`);

    return {
      delivered: false,
      previewUrl,
      provider: "console",
    };
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: process.env.EMAIL_FROM,
        name: "CV Scanner",
      },
      to: [
        {
          email: params.toEmail,
          name: params.toName,
        },
      ],
      subject: "Xac nhan email dang ky CV Scanner",
      htmlContent: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2 style="margin-bottom:12px">Xac nhan email cua ban</h2>
          <p>Xin chao ${params.toName},</p>
          <p>Nhan vao nut ben duoi de xac nhan email va kich hoat tai khoan CV Scanner.</p>
          <p style="margin:24px 0">
            <a
              href="${params.verificationUrl}"
              style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700"
            >
              Xac nhan email
            </a>
          </p>
          <p>Neu nut khong hoat dong, hay mo lien ket nay:</p>
          <p><a href="${params.verificationUrl}">${params.verificationUrl}</a></p>
          <p>Lien ket co hieu luc trong 24 gio.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Brevo send verification email failed:", detail);

    return {
      delivered: false,
      previewUrl,
      provider: "brevo",
    };
  }

  return {
    delivered: true,
    provider: "brevo",
  };
}

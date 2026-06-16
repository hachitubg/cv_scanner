const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BRAND_NAME = "L\u1ec7 HR";
const MOJIBAKE_BRAND_NAME = "L\u00e1\u00bb\u2021 HR";
const NO_VALUE_HTML = "Ch&#432;a c&#7853;p nh&#7853;t";

export type SentEmailResult = {
  delivered: boolean;
  previewUrl?: string;
  provider: "brevo" | "console";
};

type EmailRecipient = {
  email: string;
  name: string;
};

function getEmailProvider() {
  return process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "console";
}

function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || "";
}

function getEmailFromName() {
  const configuredName = process.env.EMAIL_FROM_NAME?.trim();
  if (!configuredName || configuredName === MOJIBAKE_BRAND_NAME) {
    return BRAND_NAME;
  }

  return configuredName;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
}

function htmlDocument(content: string) {
  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;background:#f8f3f5;padding:24px;font-family:Arial,'Helvetica Neue',sans-serif;color:#1f2937">
    <div style="max-width:680px;margin:0 auto;border:1px solid #ead7df;border-radius:18px;background:#ffffff;padding:28px;line-height:1.65">
      ${content}
    </div>
  </body>
</html>`;
}

function primaryButton(labelHtml: string, href: string) {
  const safeHref = escapeHtml(href);

  return `<p style="margin:26px 0">
    <a href="${safeHref}" style="display:inline-block;padding:13px 22px;background:#a03964;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700">
      ${labelHtml}
    </a>
  </p>`;
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
    Boolean(process.env.BREVO_API_KEY?.trim() && getEmailFrom())
  );
}

async function sendTransactionalEmail(params: {
  recipient: EmailRecipient;
  subject: string;
  htmlContent: string;
  previewUrl?: string;
}): Promise<SentEmailResult> {
  if (!hasBrevoConfig()) {
    console.info(
      `[email-preview] ${params.subject} -> ${params.recipient.email}${params.previewUrl ? `: ${params.previewUrl}` : ""}`,
    );

    return {
      delivered: false,
      previewUrl: params.previewUrl,
      provider: "console",
    };
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY!.trim(),
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      sender: {
        email: getEmailFrom(),
        name: getEmailFromName(),
      },
      to: [
        {
          email: params.recipient.email.trim(),
          name: params.recipient.name.trim(),
        },
      ],
      subject: params.subject,
      htmlContent: params.htmlContent,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Brevo transactional email failed:", detail);

    return {
      delivered: false,
      previewUrl: params.previewUrl,
      provider: "brevo",
    };
  }

  return {
    delivered: true,
    provider: "brevo",
  };
}

export async function sendVerificationEmail(params: {
  toEmail: string;
  toName: string;
  verificationUrl: string;
  verificationCode: string;
}): Promise<SentEmailResult> {
  const safeName = escapeHtml(params.toName);
  const safeVerificationUrl = escapeHtml(params.verificationUrl);

  return sendTransactionalEmail({
    recipient: {
      email: params.toEmail,
      name: params.toName,
    },
    subject: "M\u00e3 k\u00edch ho\u1ea1t t\u00e0i kho\u1ea3n L\u1ec7 HR",
    previewUrl: params.verificationUrl,
    htmlContent: htmlDocument(`
      <h2 style="margin:0 0 14px;font-size:22px;color:#111827">M&#227; k&#237;ch ho&#7841;t t&#224;i kho&#7843;n</h2>
      <p style="margin:0 0 12px">Xin ch&#224;o ${safeName},</p>
      <p style="margin:0 0 12px">Nh&#7853;p m&#227; b&#234;n d&#432;&#7899;i tr&#234;n m&#224;n h&#236;nh &#273;&#259;ng k&#253; &#273;&#7875; k&#237;ch ho&#7841;t t&#224;i kho&#7843;n L&#7879; HR.</p>
      <div style="margin:22px 0;padding:18px;border:1px solid #ead7df;border-radius:14px;background:#fff8fa;text-align:center">
        <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">M&#195; K&#205;CH HO&#7840;T</p>
        <p style="margin:0;font-size:32px;font-weight:900;letter-spacing:0.28em;color:#a03964">${escapeHtml(params.verificationCode)}</p>
      </div>
      <p style="margin:0 0 12px">Ho&#7863;c b&#7841;n c&#243; th&#7875; m&#7903; trang x&#225;c minh v&#224; nh&#7853;p m&#227; t&#7841;i &#273;&#226;y:</p>
      ${primaryButton("X&#225;c nh&#7853;n email", params.verificationUrl)}
      <p style="margin:0 0 8px">N&#7871;u n&#250;t kh&#244;ng ho&#7841;t &#273;&#7897;ng, h&#227;y m&#7903; li&#234;n k&#7871;t n&#224;y:</p>
      <p style="margin:0 0 12px"><a href="${safeVerificationUrl}" style="color:#a03964">${safeVerificationUrl}</a></p>
      <p style="margin:0;color:#6b7280">Li&#234;n k&#7871;t c&#243; hi&#7879;u l&#7921;c trong 24 gi&#7901;.</p>
    `),
  });
}

export async function sendWorkspaceInvitationEmail(params: {
  toEmail: string;
  toName: string;
  workspaceName: string;
  invitedByName: string;
  roleLabel: string;
  invitationUrl: string;
}) {
  const safeWorkspaceName = escapeHtml(params.workspaceName);
  const safeInvitedByName = escapeHtml(params.invitedByName);
  const safeRoleLabel = escapeHtml(params.roleLabel);
  const safeInvitationUrl = escapeHtml(params.invitationUrl);

  return sendTransactionalEmail({
    recipient: {
      email: params.toEmail,
      name: params.toName,
    },
    subject: `[${params.workspaceName}] L\u1eddi m\u1eddi tham gia workspace`,
    previewUrl: params.invitationUrl,
    htmlContent: htmlDocument(`
      <p style="margin:0 0 8px;color:#a03964;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase">L&#7900;I M&#7900;I WORKSPACE</p>
      <h2 style="margin:0 0 14px;font-size:24px;color:#111827">B&#7841;n &#273;&#432;&#7907;c m&#7901;i tham gia workspace</h2>
      <p style="margin:0 0 12px">${safeInvitedByName} &#273;&#227; m&#7901;i b&#7841;n tham gia workspace <strong>${safeWorkspaceName}</strong> v&#7899;i vai tr&#242; <strong>${safeRoleLabel}</strong>.</p>
      <p style="margin:0 0 16px">Vui l&#242;ng b&#7845;m n&#250;t b&#234;n d&#432;&#7899;i, &#273;&#259;ng nh&#7853;p b&#7857;ng &#273;&#250;ng email &#273;&#432;&#7907;c m&#7901;i v&#224; ch&#7845;p nh&#7853;n l&#7901;i m&#7901;i.</p>
      ${primaryButton("Ch&#7845;p nh&#7853;n l&#7901;i m&#7901;i", params.invitationUrl)}
      <p style="margin:0 0 8px">N&#7871;u n&#250;t kh&#244;ng ho&#7841;t &#273;&#7897;ng, h&#227;y m&#7903; li&#234;n k&#7871;t n&#224;y:</p>
      <p style="margin:0"><a href="${safeInvitationUrl}" style="color:#a03964">${safeInvitationUrl}</a></p>
    `),
  });
}

export async function sendOfferApprovalNotifications(params: {
  recipients: EmailRecipient[];
  workspaceName: string;
  candidateName: string;
  candidatePosition?: string | null;
  candidateEmail?: string | null;
  detailUrl: string;
}) {
  const safeWorkspaceName = escapeHtml(params.workspaceName);
  const safeCandidateName = escapeHtml(params.candidateName);
  const safePosition = params.candidatePosition
    ? escapeHtml(params.candidatePosition)
    : NO_VALUE_HTML;
  const safeCandidateEmail = params.candidateEmail
    ? escapeHtml(params.candidateEmail)
    : NO_VALUE_HTML;
  const safeDetailUrl = escapeHtml(params.detailUrl);
  const websiteUrl = new URL("/", params.detailUrl).toString().replace(/\/$/, "");
  const safeWebsiteUrl = escapeHtml(websiteUrl);

  const results = await Promise.all(
    params.recipients.map((recipient) =>
      sendTransactionalEmail({
        recipient,
        subject: `[${params.workspaceName}] C\u1ea7n duy\u1ec7t \u1ee9ng vi\u00ean ${params.candidateName}`,
        previewUrl: params.detailUrl,
        htmlContent: htmlDocument(`
          <p style="margin:0 0 8px;color:#a03964;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase">TH&#212;NG B&#193;O OFFER</p>
          <h2 style="margin:0 0 14px;font-size:24px;color:#111827">C&#243; &#7913;ng vi&#234;n c&#7847;n ph&#234; duy&#7879;t</h2>
          <p style="margin:0 0 12px">Xin ch&#224;o ${escapeHtml(recipient.name)},</p>
          <p style="margin:0 0 16px">&#7912;ng vi&#234;n d&#432;&#7899;i &#273;&#226;y v&#7915;a &#273;&#432;&#7907;c chuy&#7875;n sang tr&#7841;ng th&#225;i <strong>Offer</strong> trong workspace <strong>${safeWorkspaceName}</strong> v&#224; &#273;ang ch&#7901; ph&#234; duy&#7879;t.</p>
          <div style="margin:20px 0;padding:18px;border:1px solid #ead7df;border-radius:14px;background:#fff8fa">
            <p style="margin:0 0 8px"><strong>&#7912;ng vi&#234;n:</strong> ${safeCandidateName}</p>
            <p style="margin:0 0 8px"><strong>V&#7883; tr&#237;:</strong> ${safePosition}</p>
            <p style="margin:0"><strong>Email:</strong> ${safeCandidateEmail}</p>
          </div>
          ${primaryButton("Xem chi ti&#7871;t &#7913;ng vi&#234;n", params.detailUrl)}
          <p style="margin:0 0 8px">N&#7871;u n&#250;t kh&#244;ng ho&#7841;t &#273;&#7897;ng, h&#227;y m&#7903; li&#234;n k&#7871;t n&#224;y:</p>
          <p style="margin:0"><a href="${safeDetailUrl}" style="color:#a03964">${safeDetailUrl}</a></p>
          <p style="margin:18px 0 0;color:#6b7280">Website h&#7879; th&#7889;ng: <a href="${safeWebsiteUrl}" style="color:#a03964">${safeWebsiteUrl}</a></p>
        `),
      }),
    ),
  );

  return {
    delivered: results.filter((result) => result.delivered).length,
    total: results.length,
  };
}

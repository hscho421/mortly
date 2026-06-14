import { Resend } from "resend";
import { randomInt, createHash } from "crypto";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM || "noreply@mortly.ca";
const LOGO_URL = "https://mortly.ca/logo/resend_logo.png";

/**
 * Public origin for links placed INSIDE emails. A link in an email must never
 * be a localhost/loopback URL — a real recipient can't open it (a dev server
 * that sends a live email would otherwise embed a dead link). Resolution order:
 *   1. EMAIL_BASE_URL — explicit override, honored even if localhost so a dev
 *      can force local links for end-to-end testing.
 *   2. NEXTAUTH_URL — unless it points at localhost, in which case we ignore it.
 *   3. https://mortly.ca — canonical production fallback.
 */
export function emailBaseUrl(): string {
  const explicit = process.env.EMAIL_BASE_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const raw = (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
  if (!raw || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(raw)) {
    return "https://mortly.ca";
  }
  return raw;
}

const BASE_URL = emailBaseUrl();

export function generateVerificationCode(): string {
  // randomInt upper bound is exclusive — use 1_000_000 so 999999 is reachable.
  return randomInt(100000, 1_000_000).toString();
}

/**
 * Hash a verification code for at-rest storage. We email the plaintext code
 * but persist only its SHA-256 hash — consistent with how reset tokens are
 * stored (a DB-read attacker shouldn't get usable live codes). SHA-256 (not
 * bcrypt) is fine here: the input space is tiny and brute-force is bounded by
 * the 5-attempt burn + rate limits, not hash cost.
 */
export function hashVerificationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function sendVerificationCode(
  email: string,
  code: string,
  locale: string = "ko"
): Promise<void> {
  const isKo = locale === "ko";

  const subject = isKo
    ? `mortly 인증 코드: ${code}`
    : `Your mortly verification code: ${code}`;

  const html = `
    <div style="font-family: 'Outfit', 'Noto Sans KR', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #faf8f3; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${LOGO_URL}" alt="mortly" style="height: 32px; width: auto;" />
      </div>
      <div style="background: #ffffff; border-radius: 12px; padding: 32px; text-align: center;">
        <h1 style="font-size: 20px; color: #1f3528; margin: 0 0 12px;">
          ${isKo ? "이메일 인증" : "Verify Your Email"}
        </h1>
        <p style="font-size: 14px; color: #64748b; margin: 0 0 24px;">
          ${isKo ? "아래 인증 코드를 입력하여 계정을 인증하세요." : "Enter the verification code below to verify your account."}
        </p>
        <div style="background: #f0ece4; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1f3528;">${code}</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          ${isKo ? "이 코드는 10분 후 만료됩니다." : "This code expires in 10 minutes."}
        </p>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px;">
        ${isKo ? "이 이메일을 요청하지 않았다면 무시해주세요." : "If you didn't request this, please ignore this email."}
      </p>
    </div>
  `;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject,
    html,
  });
}

/**
 * Fan-out email to all existing admins announcing that a new ADMIN account
 * has just been created. Gives the admin cohort peripheral visibility so an
 * unauthorized admin mint can be detected even without someone watching the
 * audit log.
 *
 * Uses a single send per recipient so each admin sees the notice in their
 * own inbox (Resend doesn't support BCC well across regions). Empty recipient
 * list = no-op.
 */
export async function notifyAdminsOfNewAdmin(opts: {
  recipients: string[];
  newAdmin: { name: string; email: string; publicId: string };
  createdBy: { id: string; name: string | null; email: string };
}): Promise<void> {
  const { recipients, newAdmin, createdBy } = opts;
  if (recipients.length === 0) return;

  const subject = `[mortly] New admin created: ${newAdmin.name}`;
  const createdByLabel = createdBy.name ? `${createdBy.name} (${createdBy.email})` : createdBy.email;
  const reviewUrl = `${BASE_URL}/admin/system`;

  const html = `
    <div style="font-family: 'Outfit', 'Noto Sans KR', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #faf8f3;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="${LOGO_URL}" alt="mortly" style="height: 28px; width: auto;" />
      </div>
      <div style="background: #ffffff; border: 1px solid #e8e3d7; padding: 28px;">
        <div style="font-family: monospace; font-size: 11px; color: #b45309; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">
          ADMIN NOTICE · NEW ADMIN CREATED
        </div>
        <h1 style="font-size: 20px; color: #1f3528; margin: 0 0 18px;">
          A new admin account was created
        </h1>
        <table style="width: 100%; font-size: 14px; color: #1f3528; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 140px;">Name</td>
            <td style="padding: 6px 0;"><strong>${escapeHtml(newAdmin.name)}</strong></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Email</td>
            <td style="padding: 6px 0;">${escapeHtml(newAdmin.email)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Public ID</td>
            <td style="padding: 6px 0; font-family: monospace;">${escapeHtml(newAdmin.publicId)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Created by</td>
            <td style="padding: 6px 0;">${escapeHtml(createdByLabel)}</td>
          </tr>
        </table>
        <p style="margin-top: 22px; font-size: 13px; color: #64748b; line-height: 1.6;">
          If this was unexpected, review the admin audit log and revoke the account immediately.
        </p>
        <a href="${reviewUrl}" style="display: inline-block; margin-top: 12px; background: #1f3528; color: #ffffff; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 20px;">
          Open audit log
        </a>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px;">
        You received this because you are an admin on mortly.
      </p>
    </div>
  `;

  // Fan out one send per recipient. Individual failures must not abort the batch.
  await Promise.allSettled(
    recipients.map((to) =>
      getResend().emails.send({
        from: FROM,
        to,
        subject,
        html,
      }),
    ),
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generic bilingual lifecycle notification (request approved/rejected,
 * broker verified, etc.). One message carries both languages — server-side
 * senders (admin actions, webhooks, crons) have no reliable locale signal.
 */
export async function sendLifecycleEmail(opts: {
  to: string;
  subjectKo: string;
  subjectEn: string;
  bodyKo: string;
  bodyEn: string;
  ctaPath?: string;
  ctaLabelKo?: string;
  ctaLabelEn?: string;
}): Promise<void> {
  const cta =
    opts.ctaPath != null
      ? `<div style="text-align: center; margin-top: 24px;">
          <a href="${BASE_URL}${opts.ctaPath}" style="display: inline-block; background: #1f3528; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
            ${escapeHtml(opts.ctaLabelKo ?? "확인하기")} / ${escapeHtml(opts.ctaLabelEn ?? "View")}
          </a>
        </div>`
      : "";

  const html = `
    <div style="font-family: 'Outfit', 'Noto Sans KR', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #faf8f3; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${LOGO_URL}" alt="mortly" style="height: 32px; width: auto;" />
      </div>
      <div style="background: #ffffff; border-radius: 12px; padding: 32px;">
        <h1 style="font-size: 20px; color: #1f3528; margin: 0 0 12px;">
          ${escapeHtml(opts.subjectKo)}
        </h1>
        <p style="font-size: 14px; color: #1f3528; margin: 0 0 16px; line-height: 1.6;">
          ${escapeHtml(opts.bodyKo)}
        </p>
        <p style="font-size: 13px; color: #94a3b8; margin: 0; line-height: 1.6;">
          ${escapeHtml(opts.bodyEn)}
        </p>
        ${cta}
      </div>
    </div>
  `;

  await getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `[mortly] ${opts.subjectKo} / ${opts.subjectEn}`,
    html,
  });
}

/**
 * Billing notice: subscription payment failed, paid credits paused.
 * Bilingual in a single message — the Stripe webhook has no reliable locale
 * signal for the broker, and billing emails are too important to guess.
 */
export async function sendPaymentFailedEmail(
  email: string,
  billingUrl: string
): Promise<void> {
  const subject =
    "[mortly] 결제 실패 — 플랜이 일시 중지되었습니다 / Payment failed — plan paused";

  const html = `
    <div style="font-family: 'Outfit', 'Noto Sans KR', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #faf8f3; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${LOGO_URL}" alt="mortly" style="height: 32px; width: auto;" />
      </div>
      <div style="background: #ffffff; border-radius: 12px; padding: 32px;">
        <h1 style="font-size: 20px; color: #1f3528; margin: 0 0 12px;">
          결제에 실패했습니다
        </h1>
        <p style="font-size: 14px; color: #64748b; margin: 0 0 16px; line-height: 1.6;">
          구독 결제가 처리되지 않아 플랜 크레딧이 일시 중지되었습니다.
          결제 수단을 업데이트하시면 플랜과 크레딧이 즉시 복구됩니다.
        </p>
        <p style="font-size: 13px; color: #94a3b8; margin: 0 0 24px; line-height: 1.6;">
          Your subscription payment could not be processed, so your plan
          credits have been paused. Update your payment method and your plan
          and credits will be restored as soon as the payment succeeds.
        </p>
        <div style="text-align: center;">
          <a href="${billingUrl}" style="display: inline-block; background: #1f3528; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
            결제 수단 업데이트 / Update payment method
          </a>
        </div>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px;">
        mortly · 결제 관련 문의는 이 이메일에 회신해 주세요. / Reply to this email for billing questions.
      </p>
    </div>
  `;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject,
    html,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  locale: string = "ko"
): Promise<void> {
  const isKo = locale === "ko";

  const subject = isKo
    ? "mortly 비밀번호 재설정"
    : "Reset your mortly password";

  const html = `
    <div style="font-family: 'Outfit', 'Noto Sans KR', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #faf8f3; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${LOGO_URL}" alt="mortly" style="height: 32px; width: auto;" />
      </div>
      <div style="background: #ffffff; border-radius: 12px; padding: 32px; text-align: center;">
        <h1 style="font-size: 20px; color: #1f3528; margin: 0 0 12px;">
          ${isKo ? "비밀번호 재설정" : "Reset Your Password"}
        </h1>
        <p style="font-size: 14px; color: #64748b; margin: 0 0 24px;">
          ${isKo ? "아래 버튼을 클릭하여 비밀번호를 재설정하세요." : "Click the button below to reset your password."}
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #1f3528; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">
          ${isKo ? "비밀번호 재설정" : "Reset Password"}
        </a>
        <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0;">
          ${isKo ? "이 링크는 1시간 후 만료됩니다." : "This link expires in 1 hour."}
        </p>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px;">
        ${isKo ? "이 이메일을 요청하지 않았다면 무시해주세요." : "If you didn't request this, please ignore this email."}
      </p>
    </div>
  `;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject,
    html,
  });
}

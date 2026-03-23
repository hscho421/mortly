import { Resend } from "resend";
import { randomInt } from "crypto";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM || "noreply@mortly.ca";
const BASE_URL = process.env.NEXTAUTH_URL || "https://mortly.ca";
const LOGO_URL = "https://mortly.ca/logo/resend_logo.png";

export function generateVerificationCode(): string {
  return randomInt(100000, 999999).toString();
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

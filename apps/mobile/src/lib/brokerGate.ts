import type { TFunction } from "i18next";
import { checkBrokerCanMessage } from "@mortly/core/brokerEntitlement";
import type { BrokerProfile } from "@/api/client";

/** The state of a broker's "respond to this request" CTA. */
export type RespondGate =
  | { kind: "responded" }
  | { kind: "blocked"; code: string; title: string; desc: string }
  | { kind: "no_credits"; title: string; desc: string }
  | { kind: "ok"; unlimited: boolean; creditsRemaining: number };

/**
 * Decide what the respond CTA should do/show, reusing the SAME entitlement gate
 * as the server (checkBrokerCanMessage) so the UI never offers an action the API
 * will reject. Billing is web-only — blocked states link out, never purchase.
 */
export function respondGate(profile: BrokerProfile, hasResponded: boolean, t: TFunction): RespondGate {
  if (hasResponded) return { kind: "responded" };

  const entitlement = checkBrokerCanMessage({
    verificationStatus: profile.verificationStatus,
    subscriptionTier: profile.subscriptionTier,
    subscriptionStatus: profile.subscription?.status,
  });
  if (entitlement) {
    if (entitlement.code === "UPGRADE_REQUIRED") {
      return {
        kind: "blocked",
        code: entitlement.code,
        title: t("broker.freePlanTitle", "유료 플랜이 필요합니다"),
        desc: t("broker.upgradeFreeDesc", "무료 플랜은 고객에게 메시지를 보낼 수 없습니다. 웹에서 플랜을 업그레이드하세요."),
      };
    }
    if (entitlement.code === "SUBSCRIPTION_PAST_DUE") {
      return {
        kind: "blocked",
        code: entitlement.code,
        title: t("broker.pastDueTitle", "결제가 필요합니다"),
        desc: t("broker.pastDueDesc", "구독 결제가 연체되었습니다. 웹에서 결제 정보를 업데이트하세요."),
      };
    }
    return {
      kind: "blocked",
      code: entitlement.code,
      title: t("broker.verificationRequired", "인증이 필요합니다"),
      desc: t("broker.verificationRequiredDesc", "고객에게 메시지를 보내려면 인증이 필요합니다."),
    };
  }

  const unlimited = profile.subscriptionTier === "PREMIUM" && profile.subscription?.status === "ACTIVE";
  if (!unlimited && profile.responseCredits <= 0) {
    return {
      kind: "no_credits",
      title: t("credits.noCreditsTitle", "크레딧이 없습니다"),
      desc: t("credits.noCreditsMessage", "고객에게 메시지를 보내려면 응답 크레딧이 필요합니다."),
    };
  }
  return { kind: "ok", unlimited, creditsRemaining: profile.responseCredits };
}

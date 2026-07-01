import type { TFunction } from "i18next";
import { ApiError } from "@/api/client";

/** Localized message for a failed admin moderation action. */
export function adminErrorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return t("admin.rateLimited", "관리자 작업이 너무 많습니다. 잠시 후 다시 시도해주세요.");
    if (err.status === 403) return t("admin.notPermitted", "이 작업을 수행할 권한이 없습니다.");
    // 400/409 carry a specific server message on ApiError.code.
    if (err.status === 400 || err.status === 409) return err.code;
  }
  return t("admin.actionFailed", "작업에 실패했습니다. 다시 시도해주세요.");
}

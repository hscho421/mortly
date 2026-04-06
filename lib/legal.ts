export const CURRENT_LEGAL_VERSION = "2026-04-06";
export const LEGAL_ACCEPTANCE_COOKIE = "mortly_legal_acceptance";
export const LEGAL_ACCEPTANCE_COOKIE_MAX_AGE_SECONDS = 30 * 60;

export function createLegalAcceptanceMetadata() {
  return {
    legalVersion: CURRENT_LEGAL_VERSION,
    legalAcceptedAt: new Date().toISOString(),
  };
}

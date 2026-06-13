import { describe, it, expect } from "vitest";
// Plain .mjs module shared with `node scripts/scan-i18n-keys.mjs` — no types.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { scan } from "../../scripts/scan-i18n-keys.mjs";

/**
 * Regression guard for the pre-launch i18n audit: 383 t() keys were used in
 * code but existed in NEITHER locale catalog, so inline fallbacks leaked
 * Korean into the English UI and vice versa on the core authed screens.
 *
 * Every static t("key") in pages/ and components/ must exist in BOTH
 * public/locales/en/common.json and public/locales/ko/common.json.
 *
 * admin.* is exempt for now: the admin console is deliberately Korean-only
 * for launch (operators are the founders). Remove the exemption when the
 * admin app gets English support.
 */
describe("i18n key coverage", () => {
  const { totalKeys, missing } = scan();

  it("scans a sane number of keys (guard against scanner regressions)", () => {
    expect(totalKeys).toBeGreaterThan(800);
  });

  it("every user-facing t() key exists in BOTH en and ko catalogs", () => {
    const userFacing = missing
      .filter((m: { key: string }) => !m.key.startsWith("admin."))
      .map(
        (m: { key: string; inEn: boolean; inKo: boolean; sites: string[] }) =>
          `${m.key} [en:${m.inEn} ko:${m.inKo}] @ ${m.sites[0]}`,
      );
    expect(userFacing).toEqual([]);
  });
});

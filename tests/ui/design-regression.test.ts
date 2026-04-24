import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Repo-wide regression guard for the sharp design system.
 *
 * Scans every logged-in public page + the design-system-owning shared
 * components and asserts they do NOT reintroduce the legacy tokens that
 * Phase 1–5 of the public portal rewrite stripped out:
 *
 *   - `animate-fade-in` / `animate-fade-in-up`
 *   - `stagger-N` with a numeric suffix
 *   - `rounded-(2xl|xl|lg|md)` (plain `rounded-sm` and `rounded-full` are OK)
 *   - Legacy palette: `bg-rose-*` / `text-rose-*` / `border-rose-*` /
 *     `bg-sky-*` / `text-sky-*` / `border-sky-*` / `bg-red-*`
 *
 * A future regression (e.g. a copy-pasted snippet from the web) will fail
 * here before it can reach production.
 */

const ROOT = join(__dirname, "..", "..");

// Pages + components whose design is governed by the sharp system.
const TARGETS: string[] = [
  "pages/borrower/dashboard.tsx",
  "pages/borrower/profile.tsx",
  "pages/borrower/messages.tsx",
  "pages/borrower/request/new.tsx",
  "pages/borrower/request/[id].tsx",
  "pages/borrower/brokers/[requestId].tsx",
  "pages/broker/dashboard.tsx",
  "pages/broker/profile.tsx",
  "pages/broker/onboarding.tsx",
  "pages/broker/billing.tsx",
  "pages/broker/messages.tsx",
  "pages/broker/requests/index.tsx",
  "pages/broker/requests/[id].tsx",
  "components/RequestForm.tsx",
  "components/ConsultationStepper.tsx",
  "components/RequestCard.tsx",
  "components/StatusBadge.tsx",
  "components/DeleteAccountSection.tsx",
  "components/Skeleton.tsx",
];

// All admin pages + admin primitives.
function listDir(rel: string): string[] {
  const abs = join(ROOT, rel);
  try {
    return readdirSync(abs)
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
      .map((f) => join(rel, f));
  } catch {
    return [];
  }
}

const ADMIN_TARGETS: string[] = [
  ...listDir("pages/admin"),
  ...listDir("pages/admin/brokers"),
  ...listDir("pages/admin/conversations"),
  ...listDir("pages/admin/users"),
  ...listDir("components/admin"),
  ...listDir("components/admin/primitives"),
];

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

/**
 * Strip line + block comments from a source file so token scans don't trip
 * on historical references inside `//` or `/* … *\/` docstrings.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^[ \t]*\/\/.*$/gm, "")   // line comments at start of line
    .replace(/\s+\/\/.*$/gm, "");      // trailing line comments
}

describe("sharp design-system regression guard (public portal)", () => {
  it.each(TARGETS)("%s has no legacy animations", (file) => {
    const src = stripComments(read(file));
    expect(src).not.toMatch(/\banimate-fade-in(-up)?\b/);
    expect(src).not.toMatch(/\bstagger-\d\b/);
  });

  it.each(TARGETS)("%s has no legacy rounded tokens", (file) => {
    const src = stripComments(read(file));
    // rounded-sm and rounded-full are allowed; rounded-2xl/xl/lg/md are not.
    expect(src).not.toMatch(/\brounded-2xl\b/);
    expect(src).not.toMatch(/\brounded-xl\b/);
    expect(src).not.toMatch(/\brounded-lg\b/);
    expect(src).not.toMatch(/\brounded-md\b/);
  });

  it.each(TARGETS)("%s has no legacy palette (rose/sky/red-N)", (file) => {
    const src = stripComments(read(file));
    expect(src).not.toMatch(/\bbg-rose-\d/);
    expect(src).not.toMatch(/\btext-rose-\d/);
    expect(src).not.toMatch(/\bborder-rose-\d/);
    expect(src).not.toMatch(/\bbg-sky-\d/);
    expect(src).not.toMatch(/\btext-sky-\d/);
    expect(src).not.toMatch(/\bbg-red-\d/);
    expect(src).not.toMatch(/\btext-red-\d/);
  });
});

describe("sharp design-system regression guard (admin portal)", () => {
  it.each(ADMIN_TARGETS)("%s has no legacy animations", (file) => {
    const src = stripComments(read(file));
    expect(src).not.toMatch(/\banimate-fade-in(-up)?\b/);
    expect(src).not.toMatch(/\bstagger-\d\b/);
  });

  it.each(ADMIN_TARGETS)("%s has no legacy rounded tokens", (file) => {
    const src = stripComments(read(file));
    expect(src).not.toMatch(/\brounded-2xl\b/);
    expect(src).not.toMatch(/\brounded-xl\b/);
    expect(src).not.toMatch(/\brounded-lg\b/);
    expect(src).not.toMatch(/\brounded-md\b/);
  });

  it.each(ADMIN_TARGETS)("%s has no legacy palette (rose/sky/red-N)", (file) => {
    const src = stripComments(read(file));
    expect(src).not.toMatch(/\bbg-rose-\d/);
    expect(src).not.toMatch(/\btext-rose-\d/);
    expect(src).not.toMatch(/\bbg-sky-\d/);
    expect(src).not.toMatch(/\btext-sky-\d/);
    expect(src).not.toMatch(/\bbg-red-\d/);
    expect(src).not.toMatch(/\btext-red-\d/);
  });
});

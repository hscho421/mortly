/**
 * i18n key-coverage scanner.
 *
 * Extracts every static `t("key")` / `t("key", "fallback")` /
 * `t("key", { ... })` call in pages/ and components/ and reports keys that
 * are missing from public/locales/en/common.json or ko/common.json.
 *
 * Used two ways:
 *   - `node scripts/scan-i18n-keys.mjs` → human-readable report (JSON to
 *     stdout with --json)
 *   - imported by tests/i18n/key-coverage.test.ts as the CI regression guard
 *
 * Only string-literal first arguments are extractable statically; dynamic
 * keys (t(`status.${x}`), t(variable)) are out of scope and must be covered
 * by the catalogs by convention.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "api") continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(p);
    }
  }
  return out;
}

function flatten(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

// t("key"), t("key", "fallback"), t("key", { opts }), t("key", "fallback", { opts })
const T_CALL = /\bt\(\s*(["'])((?:(?!\1).)+)\1\s*(?:,\s*(["'])((?:(?!\3)[\s\S])*?)\3)?/g;

export function scan() {
  const files = [
    ...walk(path.join(ROOT, "pages")),
    ...walk(path.join(ROOT, "components")),
  ];

  /** @type {Map<string, {fallback: string|null, sites: string[]}>} */
  const keys = new Map();
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const m of src.matchAll(T_CALL)) {
      const key = m[2];
      // i18next plural/context suffixes resolve at runtime; base-key usage
      // like t("x", {count}) needs x_one/x_other instead — handled below.
      const fallback = m[4] ?? null;
      const cur = keys.get(key) ?? { fallback: null, sites: [] };
      if (fallback && !cur.fallback) cur.fallback = fallback;
      cur.sites.push(rel);
      keys.set(key, cur);
    }
  }

  const catalogs = {};
  for (const loc of ["en", "ko"]) {
    catalogs[loc] = flatten(
      JSON.parse(fs.readFileSync(path.join(ROOT, "public/locales", loc, "common.json"), "utf8")),
    );
  }

  const has = (cat, key) =>
    cat.has(key) || cat.has(`${key}_one`) || cat.has(`${key}_other`);

  const missing = [];
  for (const [key, info] of [...keys.entries()].sort()) {
    const inEn = has(catalogs.en, key);
    const inKo = has(catalogs.ko, key);
    if (!inEn || !inKo) {
      missing.push({ key, inEn, inKo, fallback: info.fallback, sites: [...new Set(info.sites)] });
    }
  }
  return { totalKeys: keys.size, missing };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { totalKeys, missing } = scan();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ totalKeys, missing }, null, 1));
  } else {
    console.log(`Scanned ${totalKeys} distinct static t() keys.`);
    const userFacing = missing.filter((m) => !m.key.startsWith("admin."));
    const admin = missing.filter((m) => m.key.startsWith("admin."));
    console.log(`Missing from a catalog: ${missing.length} (${userFacing.length} user-facing, ${admin.length} admin.*)`);
    for (const m of userFacing) {
      console.log(`  ${m.key}  [en:${m.inEn ? "y" : "N"} ko:${m.inKo ? "y" : "N"}]  fallback=${JSON.stringify(m.fallback)}  @ ${m.sites[0]}`);
    }
  }
}

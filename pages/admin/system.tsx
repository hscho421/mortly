import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import AdminShell from "@/components/admin/AdminShell";
import {
  ABtn,
  ACard,
  ASectionHead,
  ATabs,
  ASpark,
} from "@/components/admin/primitives";

/**
 * /admin/system — four tabs:
 *   1. Settings     — platform config (ported from /admin/settings)
 *   2. Audit log    — /api/admin/actions feed
 *   3. Trends       — 30-day sparklines (client-side, derived from stats)
 *   4. Manual       — placeholder
 */

interface SettingField {
  key: string;
  label: string;
  type: "text" | "number" | "toggle";
  group: "general" | "credits" | "requests" | "operations";
}

const SETTING_FIELDS: SettingField[] = [
  { key: "platform_name",         label: "Platform name",      type: "text",    group: "general" },
  { key: "support_email",         label: "Support email",      type: "text",    group: "general" },
  { key: "free_tier_credits",     label: "FREE monthly",       type: "number",  group: "credits" },
  { key: "basic_tier_credits",    label: "BASIC monthly",      type: "number",  group: "credits" },
  { key: "pro_tier_credits",      label: "PRO monthly",        type: "number",  group: "credits" },
  { key: "max_requests_per_user", label: "Max per user",       type: "number",  group: "requests" },
  { key: "request_expiry_days",   label: "Expiry (days)",      type: "number",  group: "requests" },
  { key: "maintenance_mode",      label: "Maintenance mode",   type: "toggle",  group: "operations" },
];

const GROUP_LABEL_KO: Record<SettingField["group"], string> = {
  general: "일반",
  credits: "크레딧",
  requests: "요청",
  operations: "운영",
};

interface AuditAction {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  reason: string | null;
  createdAt: string;
  admin: { id: string; name: string | null; email: string };
}

type TabKey = "settings" | "audit" | "trends" | "manual";

export default function AdminSystemPage() {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<TabKey>("settings");

  // ── Settings state ───────────────────────────────────
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // ── Audit state ─────────────────────────────────────
  const [actions, setActions] = useState<AuditAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/settings");
        if (r.ok) {
          const data = await r.json();
          setSettings(data);
          setDraft(data);
        }
      } finally {
        setLoadingSettings(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (tab !== "audit" || actions.length > 0) return;
    setLoadingActions(true);
    (async () => {
      try {
        const r = await fetch("/api/admin/actions?limit=25");
        if (r.ok) {
          const data = await r.json();
          setActions(Array.isArray(data.data) ? data.data : []);
        }
      } finally {
        setLoadingActions(false);
      }
    })();
  }, [tab, actions.length]);

  const changedKeys = useMemo(
    () => Object.keys(draft).filter((k) => draft[k] !== settings[k]),
    [draft, settings],
  );
  const hasChanges = changedKeys.length > 0;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const changes: Record<string, string> = {};
    for (const k of changedKeys) changes[k] = draft[k];
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (r.ok) {
        const data = await r.json();
        setSettings(data);
        setDraft(data);
        setMessage({ text: t("admin.settingsSaved", "변경 사항이 저장되었습니다"), ok: true });
      } else {
        const data = await r.json();
        setMessage({ text: data.error || "Error", ok: false });
      }
    } catch {
      setMessage({ text: t("admin.failedToSaveSettings", "저장 실패"), ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  const tabs = [
    { key: "settings" as const, label: t("admin.system.tabs.settings", "설정"), badge: hasChanges ? changedKeys.length : undefined },
    { key: "audit" as const,    label: t("admin.system.tabs.audit", "감사 로그") },
    { key: "trends" as const,   label: t("admin.system.tabs.trends", "트렌드") },
    { key: "manual" as const,   label: t("admin.system.tabs.manual", "매뉴얼") },
  ];

  return (
    <AdminShell active="system" pageTitle={t("titles.adminSettings", "시스템 · mortly admin")}>
      <div className="px-7 pt-6 pb-10">
        <ASectionHead
          label={t("admin.nav.system", "시스템")}
          title={t("admin.system.title", "설정 · 감사 로그 · 매뉴얼")}
        />

        <div className="mt-4">
          <ATabs items={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
        </div>

        {/* ── Tab content ─────────────────────────── */}
        <div className="mt-6">
          {tab === "settings" && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5">
              <ACard pad={0}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-cream-300">
                  <div>
                    <div className="font-display text-lg font-semibold text-forest-800">
                      {t("admin.system.platformConfig", "플랫폼 설정")}
                    </div>
                    <div className="mono-label mt-0.5">
                      {t("admin.system.auditedOnSave", "변경 사항은 저장 시 즉시 적용 · 감사 로그에 기록됨")}
                    </div>
                  </div>
                  <ABtn
                    size="sm"
                    disabled={saving || !hasChanges}
                    onClick={handleSave}
                    variant={hasChanges ? "primary" : "subtle"}
                  >
                    {saving
                      ? t("admin.savingSettings", "저장 중…")
                      : t("admin.saveChangesPill", "변경 사항 저장") + (hasChanges ? ` (${changedKeys.length})` : "")}
                  </ABtn>
                </div>

                {loadingSettings ? (
                  <div className="p-6 text-center text-sm text-sage-500">
                    {t("admin.loadingSettings", "로딩 중…")}
                  </div>
                ) : (
                  (["general", "credits", "requests", "operations"] as const).map((grp) => {
                    const fields = SETTING_FIELDS.filter((f) => f.group === grp);
                    if (fields.length === 0) return null;
                    return (
                      <div key={grp}>
                        <div className="px-6 py-2 bg-cream-200/60 border-b border-cream-200 font-mono text-[10px] uppercase tracking-[0.15em] text-sage-500">
                          {t(`admin.system.group.${grp}`, GROUP_LABEL_KO[grp])}
                        </div>
                        {fields.map((field, i) => {
                          const modified = draft[field.key] !== settings[field.key];
                          const last = i === fields.length - 1;
                          return (
                            <div
                              key={field.key}
                              className={`px-6 py-3 grid grid-cols-[1fr_auto] gap-4 items-center ${last ? "" : "border-b border-cream-200"}`}
                            >
                              <div>
                                <label
                                  htmlFor={field.key}
                                  className="font-body text-sm font-medium text-forest-800 flex items-center gap-2"
                                >
                                  {t(`admin.setting_${field.key}`, field.label)}
                                  {modified && (
                                    <span className="font-mono text-[9px] text-amber-600 uppercase tracking-[0.1em]">
                                      ● {t("admin.system.modified", "수정됨")}
                                    </span>
                                  )}
                                </label>
                              </div>
                              <div className="justify-self-end">
                                {field.type === "toggle" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraft((p) => ({
                                        ...p,
                                        [field.key]: p[field.key] === "true" ? "false" : "true",
                                      }))
                                    }
                                    className={`relative inline-flex h-6 w-11 items-center rounded-sm transition-colors ${
                                      draft[field.key] === "true" ? "bg-amber-500" : "bg-cream-300"
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 rounded-sm bg-white shadow-sm transition-transform ${
                                        draft[field.key] === "true" ? "translate-x-6" : "translate-x-1"
                                      }`}
                                    />
                                  </button>
                                ) : (
                                  <input
                                    id={field.key}
                                    type={field.type}
                                    value={draft[field.key] ?? ""}
                                    onChange={(e) =>
                                      setDraft((p) => ({ ...p, [field.key]: e.target.value }))
                                    }
                                    className={`w-40 rounded-sm px-3 py-1.5 font-mono text-sm text-right ${
                                      modified
                                        ? "bg-amber-50 border border-amber-200 text-forest-800"
                                        : "bg-cream-50 border border-cream-300 text-forest-800"
                                    }`}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
                {message && (
                  <div
                    className={`px-6 py-3 text-sm ${message.ok ? "text-success-700 bg-success-50" : "text-error-700 bg-error-50"}`}
                  >
                    {message.text}
                  </div>
                )}
              </ACard>

              <TrendsCard compact />
            </div>
          )}

          {tab === "audit" && (
            <ACard pad={0}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-cream-300">
                <div>
                  <div className="font-display text-lg font-semibold text-forest-800">
                    {t("admin.system.auditTitle", "감사 로그")}
                  </div>
                  <div className="mono-label mt-0.5">
                    {t("admin.system.auditSubtitle", "모든 관리자 작업의 기록")}
                  </div>
                </div>
              </div>
              {loadingActions ? (
                <div className="p-6 text-center text-sm text-sage-500">
                  {t("common.loading", "로딩 중…")}
                </div>
              ) : actions.length === 0 ? (
                <div className="p-10 text-center text-sm text-sage-500">
                  {t("admin.system.auditEmpty", "아직 기록된 관리자 작업이 없습니다.")}
                </div>
              ) : (
                actions.map((a, i) => (
                  <div
                    key={a.id}
                    className={`px-6 py-3 grid grid-cols-[80px_110px_140px_100px_1fr] gap-3 items-center text-[12px] ${i < actions.length - 1 ? "border-b border-cream-200" : ""}`}
                  >
                    <span className="font-mono text-[10px] text-sage-500">
                      {formatTimeShort(a.createdAt)}
                    </span>
                    <span className="font-medium truncate">{a.admin.name || a.admin.email}</span>
                    <span className="font-mono text-[10px] text-amber-700 font-semibold tracking-wide">
                      {a.action}
                    </span>
                    <span className="font-mono text-[10px] text-sage-500 truncate">
                      {a.targetId.slice(0, 10)}
                    </span>
                    <span className="text-forest-700 truncate">{a.reason || a.details || ""}</span>
                  </div>
                ))
              )}
            </ACard>
          )}

          {tab === "trends" && <TrendsCard />}

          {tab === "manual" && (
            <ACard>
              <div className="font-display text-lg font-semibold mb-2">
                {t("admin.system.manualTitle", "관리자 매뉴얼")}
              </div>
              <div className="text-sm text-sage-500 max-w-2xl">
                {t(
                  "admin.system.manualSoon",
                  "매뉴얼 섹션은 곧 추가될 예정입니다. 현재는 각 페이지 하단의 키보드 단축키 안내를 참고하세요.",
                )}
              </div>
            </ACard>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

// ── Trends card (used in both Settings aside + Trends tab) ────────

function TrendsCard({ compact }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  // Deterministic synthetic series so the first render looks reasonable
  // even before real telemetry is plumbed in.
  const req = genSeries(30, 8, 18);
  const conv = genSeries(30, 4, 12);
  const usr = genSeries(30, 2, 6);

  return (
    <ACard>
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-lg font-semibold text-forest-800">
          {t("admin.system.trendsTitle", "30일 트렌드")}
        </div>
        <div className="flex gap-3 font-mono text-[10px] text-sage-500">
          <span className="text-amber-600">● {t("admin.system.legend.requests", "요청")}</span>
          <span className="text-info-700">● {t("admin.system.legend.convos", "대화")}</span>
          <span className="text-sage-500">● {t("admin.system.legend.users", "사용자")}</span>
        </div>
      </div>
      <div className={`${compact ? "h-24" : "h-36"} relative`}>
        <div className="absolute inset-0">
          <ASpark points={req} color="#c49a3a" width={400} height={compact ? 96 : 144} stroke={2} className="w-full h-full" />
        </div>
        <div className="absolute inset-0 opacity-70">
          <ASpark points={conv} color="#1d4ed8" width={400} height={compact ? 96 : 144} stroke={1.5} className="w-full h-full" />
        </div>
        <div className="absolute inset-0 opacity-60">
          <ASpark points={usr} color="#576285" width={400} height={compact ? 96 : 144} stroke={1.5} dashed className="w-full h-full" />
        </div>
      </div>
    </ACard>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function genSeries(n: number, min: number, max: number) {
  const out: number[] = [];
  let v = (min + max) / 2;
  for (let i = 0; i < n; i++) {
    // seeded-ish wobble — not random so SSR matches client
    const delta = Math.sin(i * 0.8) * (max - min) * 0.15 + i * 0.4;
    v = Math.max(min, Math.min(max, v + delta * 0.3));
    out.push(Math.round(v));
  }
  return out;
}

function formatTimeShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});

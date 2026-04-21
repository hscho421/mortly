import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Head from "next/head";
import AdminLayout from "@/components/AdminLayout";

interface SettingField {
  key: string;
  label: string;
  type: "text" | "number" | "toggle";
  description: string;
  group: "general" | "credits" | "requests" | "operations";
}

const SETTING_FIELDS: SettingField[] = [
  { key: "platform_name", label: "Platform Name", type: "text", description: "The display name of the platform.", group: "general" },
  { key: "support_email", label: "Support Email", type: "text", description: "Contact email shown to users.", group: "general" },
  { key: "free_tier_credits", label: "Free Tier Credits", type: "number", description: "Monthly credits for free-tier brokers.", group: "credits" },
  { key: "basic_tier_credits", label: "Basic Tier Credits", type: "number", description: "Monthly credits for basic-tier brokers.", group: "credits" },
  { key: "pro_tier_credits", label: "Pro Tier Credits", type: "number", description: "Monthly credits for pro-tier brokers.", group: "credits" },
  { key: "max_requests_per_user", label: "Max Requests Per User", type: "number", description: "Maximum open requests a borrower can have.", group: "requests" },
  { key: "request_expiry_days", label: "Request Expiry (Days)", type: "number", description: "Days before an open request auto-expires.", group: "requests" },
  { key: "maintenance_mode", label: "Maintenance Mode", type: "toggle", description: "When enabled, non-admin users see a maintenance page.", group: "operations" },
];

const GROUP_LABELS: Record<SettingField["group"], string> = {
  general: "일반 · General",
  credits: "크레딧 · Credits",
  requests: "요청 · Requests",
  operations: "운영 · Operations",
};

export default function AdminSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") return;

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          setDraft(data);
        }
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [session, status, router]);

  const hasChanges = Object.keys(draft).some((k) => draft[k] !== settings[k]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const changes: Record<string, string> = {};
    for (const key of Object.keys(draft)) {
      if (draft[key] !== settings[key]) {
        changes[key] = draft[key];
      }
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setDraft(data);
        setMessage({ text: t("admin.settingsSaved", "Settings saved successfully"), ok: true });
      } else {
        const data = await res.json();
        setMessage({ text: data.error, ok: false });
      }
    } catch {
      setMessage({ text: t("admin.failedToSaveSettings", "Failed to save settings"), ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("admin.loadingSettings", "Loading settings...")}</p>
        </div>
      </AdminLayout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return null;
  }

  return (
    <AdminLayout>
      <Head><title>{t("titles.adminSettings")}</title></Head>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header — editorial */}
        <div className="mb-6 animate-fade-in">
          <div className="eyebrow">— {t("admin.sidebar.system")}</div>
          <h1 className="heading-lg mt-3">{t("admin.systemSettings", "System Settings")}</h1>
          <p className="text-body mt-2 max-w-2xl">
            {t("admin.systemSettingsDesc", "Configure platform-wide values. Changes take effect immediately.")}
          </p>
        </div>

        {/* Settings Form — grouped */}
        <div className="rounded-sm border border-cream-300 bg-cream-50 overflow-hidden animate-fade-in-up stagger-1">
          <div className="flex items-center justify-between px-5 py-4 border-b border-cream-300 bg-cream-100">
            <div>
              <div className="font-display text-lg font-semibold text-forest-800">{t("admin.platformConfig", "Platform Configuration")}</div>
              <div className="mono-label mt-0.5">{t("admin.systemSettingsShort", "Audited on save")}</div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`rounded-sm px-4 py-2 font-body text-xs font-semibold transition-colors ${
                hasChanges && !saving
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-cream-200 text-sage-500 cursor-not-allowed"
              }`}
            >
              {saving
                ? t("admin.savingSettings", "Saving...")
                : t("admin.saveSettings", "Save Changes")}
            </button>
          </div>

          {(["general", "credits", "requests", "operations"] as const).map((grp) => {
            const fields = SETTING_FIELDS.filter((f) => f.group === grp);
            if (fields.length === 0) return null;
            return (
              <div key={grp}>
                <div className="px-5 py-2 bg-cream-200/60 border-b border-cream-200 font-mono text-[10px] uppercase tracking-[0.15em] text-sage-500">
                  {GROUP_LABELS[grp]}
                </div>
                {fields.map((field, i) => {
                  const modified = draft[field.key] !== settings[field.key];
                  return (
                    <div key={field.key} className={`px-5 py-4 ${i < fields.length - 1 ? "border-b border-cream-200" : ""} grid grid-cols-[1fr_auto] gap-4 items-center`}>
                      <div>
                        <label htmlFor={field.key} className="font-body text-sm font-medium text-forest-800 flex items-center gap-2">
                          {t(`admin.setting_${field.key}`, field.label)}
                          {modified && <span className="font-mono text-[10px] text-amber-600 uppercase tracking-[0.1em]">● modified</span>}
                        </label>
                        <p className="font-body text-xs text-forest-700/60 mt-0.5">
                          {t(`admin.setting_${field.key}_desc`, field.description)}
                        </p>
                      </div>
                      <div className="w-48 shrink-0 flex justify-end">
                        {field.type === "toggle" ? (
                          <button
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                [field.key]: prev[field.key] === "true" ? "false" : "true",
                              }))
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-sm transition-colors ${
                              draft[field.key] === "true" ? "bg-amber-500" : "bg-cream-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-sm bg-white shadow-sm transition-transform ${
                                draft[field.key] === "true" ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        ) : (
                          <input
                            id={field.key}
                            type={field.type}
                            value={draft[field.key] || ""}
                            onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                            className={`w-full rounded-sm px-3 py-2 font-mono text-sm text-right transition-colors ${
                              modified
                                ? "bg-amber-50 border border-amber-300 text-forest-800"
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
          })}
        </div>

        {/* Status message */}
        {message && (
          <div className="mt-4 animate-fade-in">
            <p className={`font-body text-sm ${message.ok ? "text-success-700" : "text-red-600"}`}>
              {message.text}
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});

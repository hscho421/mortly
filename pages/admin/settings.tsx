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
}

const SETTING_FIELDS: SettingField[] = [
  { key: "platform_name", label: "Platform Name", type: "text", description: "The display name of the platform." },
  { key: "support_email", label: "Support Email", type: "text", description: "Contact email shown to users." },
  { key: "free_tier_credits", label: "Free Tier Credits", type: "number", description: "Monthly credits for free-tier brokers." },
  { key: "basic_tier_credits", label: "Basic Tier Credits", type: "number", description: "Monthly credits for basic-tier brokers." },
  { key: "pro_tier_credits", label: "Pro Tier Credits", type: "number", description: "Monthly credits for pro-tier brokers." },
  { key: "max_requests_per_user", label: "Max Requests Per User", type: "number", description: "Maximum open requests a borrower can have." },
  { key: "request_expiry_days", label: "Request Expiry (Days)", type: "number", description: "Days before an open request auto-expires." },
  { key: "maintenance_mode", label: "Maintenance Mode", type: "toggle", description: "When enabled, non-admin users see a maintenance page." },
];

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
      setMessage({ text: "Failed to save settings", ok: false });
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
      <Head><title>{t("admin.sidebar.settings")}</title></Head>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="heading-lg">{t("admin.systemSettings", "System Settings")}</h1>
          <p className="text-body mt-2">
            {t("admin.systemSettingsDesc", "Configure platform-wide values. Changes take effect immediately.")}
          </p>
        </div>

        {/* Settings Form */}
        <div className="space-y-6 animate-fade-in-up stagger-1">
          {SETTING_FIELDS.map((field) => (
            <div key={field.key} className="card-elevated">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label htmlFor={field.key} className="font-body text-sm font-semibold text-forest-800">
                    {t(`admin.setting_${field.key}`, field.label)}
                  </label>
                  <p className="font-body text-xs text-forest-700/50 mt-0.5">
                    {t(`admin.setting_${field.key}_desc`, field.description)}
                  </p>
                </div>
                <div className="w-56 shrink-0">
                  {field.type === "toggle" ? (
                    <button
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          [field.key]: prev[field.key] === "true" ? "false" : "true",
                        }))
                      }
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        draft[field.key] === "true" ? "bg-forest-600" : "bg-sage-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
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
                      className="input-field !text-sm"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save Bar */}
        <div className="mt-8 flex items-center justify-between animate-fade-in">
          {message && (
            <p className={`font-body text-sm ${message.ok ? "text-forest-600" : "text-rose-600"}`}>
              {message.text}
            </p>
          )}
          {!message && <div />}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? t("admin.savingSettings", "Saving...")
              : t("admin.saveSettings", "Save Changes")}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});

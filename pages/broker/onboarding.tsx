import { useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import type { CreateBrokerProfileInput } from "@/types";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Nova Scotia",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
];

export default function BrokerOnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  const [form, setForm] = useState<CreateBrokerProfileInput>({
    brokerageName: "",
    province: "",
    licenseNumber: "",
    bio: "",
    yearsExperience: undefined,
    areasServed: "",
    specialties: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === "loading") {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    if (typeof window !== "undefined") {
      router.push("/login", undefined, { locale: router.locale });
    }
    return null;
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "yearsExperience" ? (value ? parseInt(value, 10) : undefined) : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/brokers/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to create profile. Please try again.");
        setIsSubmitting(false);
        return;
      }

      router.push("/broker/dashboard", undefined, { locale: router.locale });
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-100">
            <svg className="h-8 w-8 text-forest-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <h1 className="heading-lg">{t("broker.onboardingTitle")}</h1>
          <p className="text-body mt-3 max-w-md mx-auto">
            {t("broker.onboardingSubtitle")}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 animate-fade-in">
            <p className="font-body text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card-elevated space-y-6 animate-fade-in-up">
          <div>
            <label htmlFor="brokerageName" className="label-text">
              {t("broker.brokerageName")} <span className="text-amber-600">*</span>
            </label>
            <input
              id="brokerageName"
              name="brokerageName"
              type="text"
              required
              value={form.brokerageName}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. Maple Mortgage Group"
            />
          </div>

          <div>
            <label htmlFor="province" className="label-text">
              {t("request.province")} <span className="text-amber-600">*</span>
            </label>
            <select
              id="province"
              name="province"
              required
              value={form.province}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">{t("request.selectProvince")}</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="licenseNumber" className="label-text">
              {t("broker.licenseNumber")} <span className="text-amber-600">*</span>
            </label>
            <input
              id="licenseNumber"
              name="licenseNumber"
              type="text"
              required
              value={form.licenseNumber}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. M12345678"
            />
          </div>

          <hr className="divider" />

          <div>
            <label htmlFor="bio" className="label-text">
              {t("broker.bio")}
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              value={form.bio || ""}
              onChange={handleChange}
              className="input-field resize-none"
              placeholder="Tell borrowers about yourself and your experience..."
            />
          </div>

          <div>
            <label htmlFor="yearsExperience" className="label-text">
              {t("broker.yearsExperience")}
            </label>
            <input
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min={0}
              max={50}
              value={form.yearsExperience ?? ""}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. 10"
            />
          </div>

          <div>
            <label htmlFor="areasServed" className="label-text">
              {t("broker.areasServed")}
            </label>
            <input
              id="areasServed"
              name="areasServed"
              type="text"
              value={form.areasServed || ""}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. Greater Toronto Area, Hamilton, Niagara"
            />
          </div>

          <div>
            <label htmlFor="specialties" className="label-text">
              {t("broker.specialties")}
            </label>
            <input
              id="specialties"
              name="specialties"
              type="text"
              value={form.specialties || ""}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g. First-time buyers, Self-employed, Refinancing"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t("broker.saving") : t("broker.save")}
          </button>
        </form>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});

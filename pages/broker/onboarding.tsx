import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import BrokerShell from "@/components/broker/BrokerShell";
import { useBrokerData } from "@/components/broker/BrokerDataContext";
import { SkeletonForm } from "@/components/Skeleton";
import type { CreateBrokerProfileInput } from "@/types";
import { useTranslation } from "next-i18next";
import { useToast } from "@/components/Toast";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import { PROVINCES } from "@/lib/requestConfig";
import { uploadBrokerAvatar } from "@/lib/uploadAvatar";
import AvatarCropper from "@/components/AvatarCropper";

export default function BrokerOnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const { refresh: refreshBrokerData } = useBrokerData();

  const [form, setForm] = useState<CreateBrokerProfileInput>({
    brokerageName: "",
    province: "",
    licenseNumber: "",
    phone: "",
    mortgageCategory: "BOTH",
    bio: "",
    yearsExperience: undefined,
    areasServed: "",
    specialties: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Deferred avatar: held client-side until submit creates the broker row,
  // then uploaded. `avatarBlob` is the resized WebP; `avatarPreview` is a
  // local object URL for the inline preview (no network until submit).
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Revoke object URLs when they change / on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);
  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  if (status === "loading") {
    return (
      <BrokerShell active="profile" pageTitle={t("titles.brokerOnboarding")} skipProfileGate>
        <Head><title>{t("titles.brokerOnboarding")}</title></Head>
        <SkeletonForm />
      </BrokerShell>
    );
  }

  // Auth gate handled by <BrokerShell> upstream.
  if (!session || session.user.role !== "BROKER") return null;

  const formatPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setForm((prev) => ({ ...prev, phone: formatPhone(value) }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      [name]: name === "yearsExperience" ? (value ? parseInt(value, 10) : undefined) : value,
    }));
  };

  // Pick a file → open the cropper. The cropped blob is held until submit.
  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
  };

  const closeCropper = () => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const onCropped = (blob: Blob) => {
    closeCropper();
    setAvatarBlob(blob);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  };

  const clearAvatar = () => {
    setAvatarBlob(null);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/brokers/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: `+1${form.phone.replace(/\D/g, "")}` }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || t("common.somethingWentWrong"));
        setIsSubmitting(false);
        return;
      }

      // Deferred avatar upload: the broker row now exists, so run the upload.
      // A failure here is NON-FATAL — onboarding already succeeded; we just
      // route the broker to their profile so they can retry, instead of
      // blocking the whole flow on a photo.
      let avatarFailed = false;
      if (avatarBlob) {
        try {
          await uploadBrokerAvatar(avatarBlob);
        } catch {
          avatarFailed = true;
        }
      }

      toast(t("broker.onboardingSuccess"), "success");
      // Refresh the shell's profile cache before navigating; otherwise the
      // dashboard would render the "Complete your profile" banner for up to
      // 30s (the polling interval) until the next counter sweep.
      await refreshBrokerData();

      if (avatarFailed) {
        toast(t("broker.avatarUploadFailed", "Upload failed. Please try again."), "error");
        router.push("/broker/profile", undefined, { locale: router.locale });
      } else {
        router.push("/broker/dashboard", undefined, { locale: router.locale });
      }
    } catch {
      setError(t("common.unexpectedError"));
      setIsSubmitting(false);
    }
  };

  return (
    <BrokerShell active="profile" pageTitle={t("titles.brokerOnboarding")} skipProfileGate>
      <Head><title>{t("titles.brokerOnboarding")}</title></Head>
      {cropSrc && (
        <AvatarCropper imageSrc={cropSrc} onCancel={closeCropper} onCropped={onCropped} />
      )}
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center ">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sm bg-forest-100">
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
          <div className="mb-6 rounded-sm bg-error-50 border border-error-500/20 p-4 " role="alert">
            <p className="font-body text-sm text-error-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card-elevated space-y-6">
          {/* Optional profile photo — uploaded after the profile is created. */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-100 text-forest-700">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt={t("broker.profilePhotoAlt", "Profile photo")} className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-xl">
                  {(form.brokerageName || session.user.name || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="font-body text-sm font-semibold text-forest-800">
                {t("broker.profilePhoto", "Profile photo")}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <label className="btn-secondary cursor-pointer text-sm py-1.5 px-3">
                  {avatarPreview ? t("broker.avatarChange", "Change photo") : t("broker.avatarUpload", "Upload photo")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={isSubmitting}
                    onChange={onPickAvatar}
                  />
                </label>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    disabled={isSubmitting}
                    className="rounded-sm border border-error-300 bg-white px-3 py-1.5 text-sm font-body font-medium text-error-600 hover:bg-error-50 disabled:opacity-50"
                  >
                    {t("broker.avatarRemove", "Remove")}
                  </button>
                )}
              </div>
              <p className="mt-1.5 font-body text-xs text-sage-400">
                {t("broker.avatarOptionalHint", "Optional. JPG, PNG or WebP — added when you finish.")}
              </p>
            </div>
          </div>

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
              placeholder={t("onboarding.placeholderBrokerage")}
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
              {t("broker.licenseNumber")}
            </label>
            <input
              id="licenseNumber"
              name="licenseNumber"
              type="text"
              value={form.licenseNumber}
              onChange={handleChange}
              className="input-field"
              placeholder={t("onboarding.placeholderLicense")}
            />
          </div>

          <div>
            <label htmlFor="phone" className="label-text">
              {t("broker.phone")} <span className="text-amber-600">*</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-4 rounded-l-sm border border-r-0 border-cream-300 bg-cream-50 font-body text-sm text-forest-700/70">
                +1
              </span>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={form.phone}
                onChange={handleChange}
                className="input-field !rounded-l-none"
                placeholder={t("onboarding.placeholderPhone")}
              />
            </div>
          </div>

          <div>
            <label className="label-text mb-3 block">
              {t("broker.mortgageCategory")}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["RESIDENTIAL", "COMMERCIAL", "BOTH"] as const).map((cat) => {
                const labelKey =
                  cat === "RESIDENTIAL"
                    ? "broker.residential"
                    : cat === "COMMERCIAL"
                      ? "broker.commercial"
                      : "broker.both";
                const isSelected = form.mortgageCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, mortgageCategory: cat }))
                    }
                    className={`rounded-sm border-2 px-2 py-2.5 text-center font-body text-[13px] font-medium transition-all sm:px-3 sm:py-3 sm:text-sm ${
                      isSelected
                        ? "border-forest-600 bg-forest-50 text-forest-800"
                        : "border-cream-200 bg-white text-sage-500 hover:border-forest-300 hover:bg-cream-50"
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
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
              placeholder={t("onboarding.placeholderBio")}
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
              placeholder={t("onboarding.placeholderYears")}
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
              placeholder={t("onboarding.placeholderAreas")}
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
              placeholder={t("onboarding.placeholderSpecialties")}
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
    </BrokerShell>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});

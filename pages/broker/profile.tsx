import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import BrokerShell from "@/components/broker/BrokerShell";
import { useBrokerData } from "@/components/broker/BrokerDataContext";
import { SkeletonProfile } from "@/components/Skeleton";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import type { CreateBrokerProfileInput } from "@/types";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import { PROVINCES } from "@/lib/requestConfig";
import { supabase, AVATAR_BUCKET, avatarPublicUrl } from "@/lib/supabase";
import { resizeAvatar } from "@/lib/resizeImage";

interface BrokerUser {
  id: string;
  publicId: string;
  name: string | null;
  email: string;
}

interface BrokerProfile extends CreateBrokerProfileInput {
  id: string;
  verificationStatus: string;
  subscriptionTier: string;
  responseCredits: number;
  profilePhoto?: string | null;
  user?: BrokerUser;
}

export default function BrokerProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
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
  const [brokerUser, setBrokerUser] = useState<BrokerUser | null>(null);
  const [verificationStatus, setVerificationStatus] = useState("PENDING");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const formatPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  useEffect(() => {
    // Auth gate handled by <BrokerShell> upstream — only fetch when ready.
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/brokers/profile");
        if (!res.ok) throw new Error(t("borrowerProfile.failedToFetch"));
        const data: BrokerProfile = await res.json();
        const rawPhone = (data.phone || "").replace(/^\+1/, "");
        setForm({
          brokerageName: data.brokerageName,
          province: data.province,
          licenseNumber: data.licenseNumber,
          phone: formatPhone(rawPhone),
          mortgageCategory: data.mortgageCategory || "BOTH",
          bio: data.bio || "",
          yearsExperience: data.yearsExperience ?? undefined,
          areasServed: data.areasServed || "",
          specialties: data.specialties || "",
        });
        setVerificationStatus(data.verificationStatus);
        if (data.user) setBrokerUser(data.user);
        if (data.profilePhoto) setPhotoUrl(avatarPublicUrl(data.profilePhoto));
      } catch {
        setError(t("broker.failedToLoadProfile"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session, status, router]);

  if (status === "loading" || isLoading) {
    return (
      <BrokerShell active="profile" pageTitle={t("titles.brokerProfile")}>
        <Head><title>{t("titles.brokerProfile")}</title></Head>
        <SkeletonProfile />
      </BrokerShell>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    return null;
  }

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

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the user re-pick the same file later
    if (!file) return;
    setError("");
    setSuccess("");
    setPhotoBusy(true);
    try {
      // 1. resize/crop/re-encode client-side (caps storage + strips EXIF)
      const blob = await resizeAvatar(file);
      // 2. get a path-scoped signed upload URL from our API
      const urlRes = await fetch("/api/brokers/avatar/upload-url", { method: "POST" });
      if (!urlRes.ok) {
        const d = await urlRes.json().catch(() => ({}));
        throw new Error(d.error || t("broker.avatarUploadFailed", "Upload failed. Please try again."));
      }
      const { path, token } = await urlRes.json();
      // 3. upload the blob directly to Supabase Storage (not via our function)
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .uploadToSignedUrl(path, token, blob, { contentType: "image/webp" });
      if (upErr) throw new Error(t("broker.avatarUploadFailed", "Upload failed. Please try again."));
      // 4. confirm — persist the path on the broker row
      const confirmRes = await fetch("/api/brokers/avatar", { method: "POST" });
      if (!confirmRes.ok) throw new Error(t("broker.avatarUploadFailed", "Upload failed. Please try again."));
      const { url } = await confirmRes.json();
      // cache-bust so the CDN/browser don't serve the old image at the same path
      setPhotoUrl((url || avatarPublicUrl(path)) + `?v=${Date.now()}`);
      setSuccess(t("broker.avatarUpdated", "Profile photo updated."));
      // Refresh the shared context so the sidebar avatar updates immediately
      // (it reads from BrokerDataContext, otherwise stale until the 30s poll).
      refreshBrokerData().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : t("broker.avatarUploadFailed", "Upload failed. Please try again."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const onRemoveAvatar = async () => {
    setError("");
    setSuccess("");
    setPhotoBusy(true);
    try {
      const res = await fetch("/api/brokers/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error(t("broker.avatarRemoveFailed", "Could not remove the photo."));
      setPhotoUrl(null);
      setSuccess(t("broker.avatarRemoved", "Profile photo removed."));
      refreshBrokerData().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : t("broker.avatarRemoveFailed", "Could not remove the photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const res = await fetch("/api/brokers/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: form.phone ? `+1${form.phone.replace(/\D/g, "")}` : undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || t("broker.failedToUpdateProfile"));
        setIsSaving(false);
        return;
      }

      setSuccess(t("broker.profileUpdated"));
      setIsSaving(false);
    } catch {
      setError(t("common.unexpectedError"));
      setIsSaving(false);
    }
  };

  const verificationColors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    VERIFIED: "bg-forest-100 text-forest-800",
    REJECTED: "bg-error-100 text-error-800",
  };

  return (
    <BrokerShell active="profile" pageTitle={t("titles.brokerProfile")}>
      <Head><title>{t("titles.brokerProfile")}</title></Head>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between ">
          <div>
            <h1 className="heading-lg">{t("broker.editProfile")}</h1>
            <p className="text-body mt-2">
              {t("broker.profileSubtitle")}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 font-body text-xs font-semibold ${verificationColors[verificationStatus] || verificationColors.PENDING}`}
          >
            {verificationStatus === "VERIFIED"
              ? t("status.verified")
              : verificationStatus === "REJECTED"
                ? t("status.rejected")
                : t("status.pending")}
          </span>
        </div>

        {error && (
          <div className="mb-6 rounded-sm bg-error-50 border border-error-500/20 p-4 " role="alert">
            <p className="font-body text-sm text-error-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-sm bg-forest-50 border border-forest-200 p-4 ">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-forest-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <p className="font-body text-sm text-forest-700">{success}</p>
            </div>
          </div>
        )}

        {/* Profile photo — verified brokers only (matches the API gate). */}
        <div className="card-elevated mb-6 flex items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-100 text-forest-700">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={t("broker.profilePhotoAlt", "Profile photo")}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-2xl">
                {(form.brokerageName || brokerUser?.name || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="font-body text-sm font-semibold text-forest-800">
              {t("broker.profilePhoto", "Profile photo")}
            </p>
            {verificationStatus === "VERIFIED" ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="btn-secondary cursor-pointer text-sm py-1.5 px-3">
                    {photoBusy
                      ? t("broker.avatarUploading", "Uploading…")
                      : photoUrl
                        ? t("broker.avatarChange", "Change photo")
                        : t("broker.avatarUpload", "Upload photo")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={photoBusy}
                      onChange={onPickAvatar}
                    />
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={onRemoveAvatar}
                      disabled={photoBusy}
                      className="rounded-sm border border-error-300 bg-white px-3 py-1.5 text-sm font-body font-medium text-error-600 hover:bg-error-50 disabled:opacity-50"
                    >
                      {t("broker.avatarRemove", "Remove")}
                    </button>
                  )}
                </div>
                <p className="mt-1.5 font-body text-xs text-sage-400">
                  {t("broker.avatarHint", "JPG, PNG or WebP. Squared and resized automatically.")}
                </p>
              </>
            ) : (
              <p className="mt-1 font-body text-xs text-sage-400">
                {t("broker.avatarVerifiedOnly", "Available once your account is verified.")}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated space-y-6">
          {brokerUser && (
            <div>
              <label className="label-text">{t("settings.userId", "User ID")}</label>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-forest-800 bg-cream-100 rounded-sm px-3 py-2">
                  {brokerUser.publicId}
                </p>
                <p className="font-body text-xs text-sage-400">
                  {t("settings.userIdNote", "Use this ID when contacting support.")}
                </p>
              </div>
            </div>
          )}

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
            />
          </div>

          {brokerUser && (
            <div>
              <label className="label-text">{t("broker.email")}</label>
              <input
                type="email"
                disabled
                value={brokerUser.email}
                className="input-field bg-cream-50 text-sage-500 cursor-not-allowed"
              />
            </div>
          )}

          <div>
            <label htmlFor="phone" className="label-text">
              {t("broker.phone")} <span className="text-amber-600">*</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-cream-300 bg-cream-50 font-body text-sm text-forest-700/70">
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
                placeholder="(416) 555-1234"
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
                    className={`rounded-sm border-2 px-3 py-3 text-center font-body text-sm font-medium transition-all ${
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
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? t("broker.saving") : t("broker.save")}
          </button>
        </form>

        {/* Account deletion — Apple App Store guideline 5.1.1(v) */}
        <DeleteAccountSection />
      </div>
    </BrokerShell>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "ko", ["common"])),
  },
});

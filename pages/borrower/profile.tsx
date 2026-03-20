import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

interface BorrowerProfile {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  _count: {
    borrowerRequests: number;
    conversations: number;
    reviews: number;
  };
}

export default function BorrowerProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BORROWER") {
      router.push("/login", undefined, { locale: router.locale });
      return;
    }

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/borrowers/profile");
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data: BorrowerProfile = await res.json();
        setProfile(data);
        setName(data.name || "");
      } catch {
        setError("Failed to load profile.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session, status, router]);

  const handleUpdateName = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const res = await fetch("/api/borrowers/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update profile");
      }

      setSuccess(t("settings.profileUpdated", "Profile updated successfully."));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError(t("auth.passwordMismatch", "Passwords do not match"));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t("auth.passwordTooShort", "Password must be at least 8 characters"));
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch("/api/borrowers/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to change password");
      }

      setPasswordSuccess(t("settings.passwordChanged", "Password changed successfully."));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BORROWER") return null;

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="heading-lg">{t("settings.title", "Account Settings")}</h1>
          <p className="text-body mt-2">
            {t("settings.subtitle", "Manage your profile and account preferences.")}
          </p>
        </div>

        {/* Account stats */}
        {profile && (
          <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-in-up stagger-1">
            <div className="card-elevated !p-5 text-center">
              <p className="heading-md text-amber-600">{profile._count.borrowerRequests}</p>
              <p className="text-body-sm mt-1">{t("settings.requests", "Requests")}</p>
            </div>
            <div className="card-elevated !p-5 text-center">
              <p className="heading-md text-amber-600">{profile._count.conversations}</p>
              <p className="text-body-sm mt-1">{t("settings.conversations", "Conversations")}</p>
            </div>
            <div className="card-elevated !p-5 text-center">
              <p className="heading-md text-amber-600">{profile._count.reviews}</p>
              <p className="text-body-sm mt-1">{t("settings.reviewsGiven", "Reviews Given")}</p>
            </div>
          </div>
        )}

        {/* Profile section */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-2">
          <h2 className="heading-sm mb-5">{t("settings.profileInfo", "Profile Information")}</h2>

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 animate-fade-in">
              <p className="font-body text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl bg-forest-50 border border-forest-200 px-4 py-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-forest-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <p className="font-body text-sm text-forest-700">{success}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleUpdateName} className="space-y-5">
            <div>
              <label htmlFor="name" className="label-text">
                {t("auth.name")}
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-text">{t("auth.email")}</label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="input-field !bg-cream-100 !text-sage-400 cursor-not-allowed"
              />
              <p className="mt-1.5 font-body text-xs text-sage-400">
                {t("settings.emailNote", "Email cannot be changed.")}
              </p>
            </div>

            {profile && (
              <div>
                <label className="label-text">{t("settings.memberSince", "Member Since")}</label>
                <p className="text-body-sm">
                  {new Date(profile.createdAt).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? t("broker.saving") : t("settings.saveChanges", "Save Changes")}
            </button>
          </form>
        </div>

        {/* Change password section */}
        <div className="card-elevated animate-fade-in-up stagger-3">
          <h2 className="heading-sm mb-5">{t("settings.changePassword", "Change Password")}</h2>

          {passwordError && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 animate-fade-in">
              <p className="font-body text-sm text-red-700">{passwordError}</p>
            </div>
          )}

          {passwordSuccess && (
            <div className="mb-5 rounded-xl bg-forest-50 border border-forest-200 px-4 py-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-forest-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <p className="font-body text-sm text-forest-700">{passwordSuccess}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label htmlFor="currentPassword" className="label-text">
                {t("settings.currentPassword", "Current Password")}
              </label>
              <input
                id="currentPassword"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="label-text">
                {t("auth.newPassword", "New Password")}
              </label>
              <input
                id="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                placeholder={t("settings.minChars", "At least 8 characters")}
              />
            </div>

            <div>
              <label htmlFor="confirmNewPassword" className="label-text">
                {t("auth.confirmNewPassword", "Confirm New Password")}
              </label>
              <input
                id="confirmNewPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isChangingPassword
                ? t("settings.changingPassword", "Changing...")
                : t("settings.changePasswordBtn", "Change Password")}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});

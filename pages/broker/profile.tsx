import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import type { CreateBrokerProfileInput } from "@/types";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  borrower: { name: string | null };
}

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

interface BrokerProfile extends CreateBrokerProfileInput {
  id: string;
  verificationStatus: string;
  subscriptionTier: string;
  responseCredits: number;
  rating: number | null;
  completedMatches: number;
}

export default function BrokerProfilePage() {
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
  const [verificationStatus, setVerificationStatus] = useState("PENDING");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [brokerRating, setBrokerRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login");
      return;
    }

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/brokers/profile");
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data: BrokerProfile = await res.json();
        setForm({
          brokerageName: data.brokerageName,
          province: data.province,
          licenseNumber: data.licenseNumber,
          bio: data.bio || "",
          yearsExperience: data.yearsExperience ?? undefined,
          areasServed: data.areasServed || "",
          specialties: data.specialties || "",
        });
        setVerificationStatus(data.verificationStatus);
        setBrokerRating(data.rating);

        // Fetch reviews
        if (data.id) {
          const reviewRes = await fetch(`/api/reviews?brokerId=${data.id}`);
          if (reviewRes.ok) {
            const reviewData: ReviewItem[] = await reviewRes.json();
            setReviews(reviewData);
          }
        }
      } catch {
        setError("Failed to load profile data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session, status, router]);

  if (status === "loading" || isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
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
    setSuccess("");
    setIsSaving(true);

    try {
      const res = await fetch("/api/brokers/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to update profile.");
        setIsSaving(false);
        return;
      }

      setSuccess("Profile updated successfully.");
      setIsSaving(false);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsSaving(false);
    }
  };

  const verificationColors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    VERIFIED: "bg-forest-100 text-forest-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
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
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 animate-fade-in">
            <p className="font-body text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl bg-forest-50 border border-forest-200 p-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-forest-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <p className="font-body text-sm text-forest-700">{success}</p>
            </div>
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

        {/* Reviews section */}
        <div className="mt-10 animate-fade-in-up stagger-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="heading-md">{t("review.myReviews", "My Reviews")}</h2>
            {brokerRating != null && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(brokerRating) ? "text-amber-400" : "text-cream-300"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="font-body text-sm font-semibold text-forest-800">
                  {brokerRating.toFixed(1)}
                </span>
                <span className="text-body-sm">
                  ({reviews.length} {reviews.length === 1 ? t("review.reviewSingular", "review") : t("review.reviewPlural", "reviews")})
                </span>
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="card-elevated text-center py-10">
              <p className="heading-sm mb-2">{t("review.noReviews", "No Reviews Yet")}</p>
              <p className="text-body-sm">
                {t("review.noReviewsDesc", "Reviews from borrowers will appear here after conversations are closed.")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="card-elevated">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-cream-200 text-forest-700 flex items-center justify-center text-sm font-display font-bold">
                        {(review.borrower.name || "B").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-body text-sm font-semibold text-forest-800">
                          {review.borrower.name || t("messages.borrowerLabel")}
                        </p>
                        <p className="text-xs font-body text-sage-400">
                          {new Date(review.createdAt).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.rating ? "text-amber-400" : "text-cream-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-body-sm">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
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

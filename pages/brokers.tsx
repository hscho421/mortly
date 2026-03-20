import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import Link from "next/link";
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

interface BrokerReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  borrower: { name: string | null };
}

interface BrokerListing {
  id: string;
  brokerageName: string;
  province: string;
  bio: string | null;
  yearsExperience: number | null;
  areasServed: string | null;
  specialties: string | null;
  rating: number | null;
  completedMatches: number;
  mortgageCategory?: string | null;
  user: { name: string | null };
  reviews: BrokerReview[];
}

export default function BrokerDirectoryPage() {
  const { t } = useTranslation("common");
  const [brokers, setBrokers] = useState<BrokerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [province, setProvince] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrokers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (province) params.set("province", province);
        const res = await fetch(`/api/brokers?${params}`);
        if (res.ok) {
          const data: BrokerListing[] = await res.json();
          setBrokers(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchBrokers();
  }, [province]);

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center animate-fade-in">
          <div className="mb-4 flex justify-center">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-amber-400" />
              <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                {t("directory.badge", "Verified Professionals")}
              </span>
              <div className="h-px w-8 bg-amber-400" />
            </div>
          </div>
          <h1 className="heading-xl mb-3">{t("directory.title", "Broker Directory")}</h1>
          <p className="text-body mx-auto max-w-2xl">
            {t("directory.subtitle", "Browse verified mortgage brokers across Canada. When you're ready, submit a request to have brokers come to you.")}
          </p>
        </div>

        {/* Filter */}
        <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up stagger-1">
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="input-field w-full sm:w-64"
          >
            <option value="">{t("broker.allProvinces")}</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <div className="flex-1" />

          <p className="text-body-sm">
            {brokers.length} {brokers.length === 1
              ? t("directory.brokerFound", "broker found")
              : t("directory.brokersFound", "brokers found")}
          </p>
        </div>

        {/* Broker list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-body-sm">{t("broker.loadingRequests")}</p>
          </div>
        ) : brokers.length === 0 ? (
          <div className="card-elevated text-center py-16 animate-fade-in">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cream-200">
              <svg className="h-7 w-7 text-forest-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <p className="heading-sm mb-2">{t("directory.noBrokers", "No Brokers Found")}</p>
            <p className="text-body-sm">
              {t("directory.noBrokersDesc", "Try adjusting your filters or check back later.")}
            </p>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in-up stagger-2">
            {brokers.map((broker) => {
              const isExpanded = expandedId === broker.id;
              const specialties = broker.specialties
                ? broker.specialties.split(",").map((s) => s.trim()).filter(Boolean)
                : [];

              return (
                <div key={broker.id} className="card-elevated transition-all duration-200">
                  {/* Main info */}
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center text-xl font-display font-bold shrink-0">
                      {(broker.user.name || "B").charAt(0).toUpperCase()}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h2 className="font-body text-base font-semibold text-forest-800 truncate">
                          {broker.user.name || broker.brokerageName}
                        </h2>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-forest-700 bg-forest-100 px-2 py-0.5 rounded-full font-medium font-body shrink-0">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {t("status.verified")}
                        </span>
                      </div>

                      <p className="text-body-sm mb-1">{broker.brokerageName}</p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-body text-sage-400">
                        <span>{broker.province}</span>
                        {broker.yearsExperience != null && (
                          <span>{broker.yearsExperience} {t("directory.yearsExp", "years experience")}</span>
                        )}
                        {broker.rating != null && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {broker.rating.toFixed(1)}
                            <span className="text-sage-300">({broker.completedMatches})</span>
                          </span>
                        )}
                        {broker.mortgageCategory && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            {broker.mortgageCategory === "RESIDENTIAL"
                              ? t("broker.residential")
                              : broker.mortgageCategory === "COMMERCIAL"
                                ? t("broker.commercial")
                                : t("broker.both")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : broker.id)}
                      className="btn-secondary !py-2 !px-3 !text-xs shrink-0"
                    >
                      {isExpanded
                        ? t("directory.showLess", "Show Less")
                        : t("directory.viewProfile", "View Profile")}
                    </button>
                  </div>

                  {/* Specialties */}
                  {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {specialties.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-full bg-forest-50 px-2.5 py-1 font-body text-[11px] font-medium text-forest-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expanded section */}
                  {isExpanded && (
                    <div className="mt-5 pt-5 border-t border-cream-200 animate-fade-in">
                      {/* Bio */}
                      {broker.bio && (
                        <div className="mb-5">
                          <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-1">
                            {t("directory.about", "About")}
                          </p>
                          <p className="text-body-sm">{broker.bio}</p>
                        </div>
                      )}

                      {/* Areas served */}
                      {broker.areasServed && (
                        <div className="mb-5">
                          <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-1">
                            {t("directory.areasServed", "Areas Served")}
                          </p>
                          <p className="text-body-sm">{broker.areasServed}</p>
                        </div>
                      )}

                      {/* Recent reviews */}
                      {broker.reviews.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold font-body text-sage-500 uppercase tracking-widest mb-3">
                            {t("directory.recentReviews", "Recent Reviews")}
                          </p>
                          <div className="space-y-3">
                            {broker.reviews.map((review) => (
                              <div key={review.id} className="rounded-xl bg-cream-50 border border-cream-200 p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <svg
                                        key={star}
                                        className={`w-3.5 h-3.5 ${star <= review.rating ? "text-amber-400" : "text-cream-300"}`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    ))}
                                  </div>
                                  <span className="text-[11px] font-body text-sage-400">
                                    {new Date(review.createdAt).toLocaleDateString("en-CA", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </div>
                                {review.comment && (
                                  <p className="text-body-sm">{review.comment}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      <div className="mt-6 rounded-xl bg-forest-50 border border-forest-200 p-4 flex items-center justify-between">
                        <p className="text-body-sm font-medium">
                          {t("directory.ctaText", "Want this broker to reach out to you?")}
                        </p>
                        <Link href="/signup" className="btn-amber !py-2 !px-4 !text-xs shrink-0">
                          {t("directory.ctaBtn", "Submit a Request")}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});

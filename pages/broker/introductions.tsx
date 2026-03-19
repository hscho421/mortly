import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";

interface IntroductionItem {
  id: string;
  requestId: string;
  howCanHelp: string;
  personalMessage: string;
  estimatedTimeline: string | null;
  createdAt: string;
  conversationId?: string | null;
  request?: {
    id: string;
    requestType: string;
    province: string;
    city?: string | null;
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function displayLabel(val: string | null | undefined) {
  if (!val) return "--";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

export default function BrokerIntroductionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");

  const [introductions, setIntroductions] = useState<IntroductionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login");
      return;
    }

    const fetchIntroductions = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/introductions?requestId=all");
        if (!res.ok) throw new Error("Failed to fetch introductions");
        const data = await res.json();
        setIntroductions(data);
      } catch {
        setError("Failed to load your introductions.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntroductions();
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

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <h1 className="heading-lg">{t("broker.myIntroductions")}</h1>
          <p className="text-body mt-2">
            {t("broker.introsSubtitle")}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 animate-fade-in">
            <p className="font-body text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Introduction list */}
        {introductions.length === 0 ? (
          <div className="card-elevated text-center py-16 animate-fade-in-up stagger-1">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cream-200">
              <svg
                className="h-8 w-8 text-forest-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                />
              </svg>
            </div>
            <h2 className="heading-md mb-2">{t("broker.noIntroductions")}</h2>
            <p className="text-body mb-6 max-w-md mx-auto">
              {t("broker.noIntrosDesc")}
            </p>
            <Link href="/broker/requests" className="btn-amber">
              {t("broker.browseRequests")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {introductions.map((intro, i) => {
              const staggerClass =
                i < 6 ? `stagger-${i + 1}` : "stagger-6";
              const hasConversation = !!intro.conversationId;

              return (
                <Link
                  key={intro.id}
                  href={`/broker/requests/${intro.requestId}`}
                  className={`card-elevated group block transition-all hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up ${staggerClass}`}
                >
                  {/* Top row: request type + status */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center rounded-full bg-forest-100 px-2.5 py-0.5 font-body text-xs font-semibold text-forest-700">
                      {displayLabel(intro.request?.requestType)}
                    </span>
                    {hasConversation ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        {t("broker.connected")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        {t("broker.awaitingResponse")}
                      </span>
                    )}
                  </div>

                  {/* Province */}
                  <h3 className="heading-sm mb-3 group-hover:text-forest-900 transition-colors">
                    {intro.request?.city
                      ? `${intro.request.city}, `
                      : ""}
                    {intro.request?.province || "--"}
                  </h3>

                  {/* How can help preview */}
                  <div className="mb-2">
                    <span className="font-body text-[11px] font-medium uppercase tracking-wider text-forest-700/50">
                      {t("broker.howYouCanHelp")}
                    </span>
                    <p className="font-body text-sm text-forest-800 mt-0.5">
                      {truncate(intro.howCanHelp, 120)}
                    </p>
                  </div>

                  {/* Personal message preview */}
                  <div className="mb-3">
                    <span className="font-body text-[11px] font-medium uppercase tracking-wider text-forest-700/50">
                      {t("broker.personalMessage")}
                    </span>
                    <p className="font-body text-sm text-forest-700 mt-0.5">
                      {truncate(intro.personalMessage, 100)}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-cream-200">
                    <span className="text-body-sm">
                      {formatDate(intro.createdAt)}
                    </span>
                    {intro.estimatedTimeline && (
                      <span className="font-body text-xs font-medium text-sage-600">
                        Timeline: {intro.estimatedTimeline}
                      </span>
                    )}
                  </div>
                </Link>
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

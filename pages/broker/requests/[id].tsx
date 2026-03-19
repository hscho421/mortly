import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import type { RequestWithIntroductions } from "@/types";

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BrokerRequestDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest] = useState<RequestWithIntroductions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading" || !id) return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login");
      return;
    }

    const fetchRequest = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/requests/${id}`);
        if (!res.ok) throw new Error("Failed to fetch request");
        const data = await res.json();
        setRequest(data);
      } catch {
        setError("Failed to load request details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequest();
  }, [session, status, router, id]);

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

  if (error || !request) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="font-body text-sm text-red-700">{error || "Request not found."}</p>
          </div>
          <Link
            href="/broker/requests"
            className="mt-4 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
          >
            &larr; Back to Requests
          </Link>
        </div>
      </Layout>
    );
  }

  const hasResponded = request.introductions
    ? request.introductions.some(
        (intro) => intro.broker?.userId === session.user.id
      )
    : (request._count?.introductions ?? 0) > 0;

  const statusColors: Record<string, string> = {
    OPEN: "bg-forest-100 text-forest-700",
    IN_PROGRESS: "bg-amber-100 text-amber-700",
    EXPIRED: "bg-sage-100 text-sage-600",
    CLOSED: "bg-sage-100 text-sage-700",
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in">
        <Link
          href="/broker/requests"
          className="mb-8 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Requests
        </Link>

        <div className="card-elevated animate-fade-in-up">
          {/* Header badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-forest-100 px-2.5 py-0.5 font-body text-xs font-semibold text-forest-700">
              {request.requestType}
            </span>
            <span className="inline-flex items-center rounded-full bg-sage-100 px-2.5 py-0.5 font-body text-xs font-semibold text-sage-700">
              {request.propertyType}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${statusColors[request.status] || "bg-sage-100 text-sage-700"}`}>
              {request.status}
            </span>
          </div>

          <h1 className="heading-lg mb-2">
            {request.requestType} in {request.city ? `${request.city}, ` : ""}
            {request.province}
          </h1>
          <p className="text-body-sm mb-8">
            Posted {formatDate(request.createdAt as unknown as string)} &middot;{" "}
            {request._count?.introductions ?? 0} broker response(s)
          </p>

          <hr className="divider mb-8" />

          {/* Details grid */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              { label: "Price Range", value: `${formatCurrency(request.priceRangeMin)} - ${formatCurrency(request.priceRangeMax)}` },
              { label: "Mortgage Amount", value: `${formatCurrency(request.mortgageAmountMin)} - ${formatCurrency(request.mortgageAmountMax)}` },
              { label: "Down Payment", value: request.downPaymentPercent || "Not specified" },
              { label: "Closing Timeline", value: request.closingTimeline || "Not specified" },
              { label: "Employment Type", value: request.employmentType || "Not specified" },
              { label: "Credit Score Band", value: request.creditScoreBand || "Not specified" },
              { label: "Income Range", value: `${formatCurrency(request.incomeRangeMin)} - ${formatCurrency(request.incomeRangeMax)}` },
              { label: "Existing Debt", value: `${formatCurrency(request.debtRangeMin)} - ${formatCurrency(request.debtRangeMax)}` },
              { label: "Preferred Term", value: request.preferredTerm || "Not specified" },
              { label: "Preferred Rate Type", value: request.preferredType || "Not specified" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-cream-100 p-4">
                <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">{item.label}</h3>
                <p className="mt-1 font-body text-sm font-medium text-forest-800">{item.value}</p>
              </div>
            ))}
          </div>

          {request.notes && (
            <div className="mb-8 rounded-xl bg-cream-100 p-5">
              <h3 className="font-body text-xs font-medium uppercase tracking-wider text-forest-700/50">Additional Notes</h3>
              <p className="mt-2 font-body text-sm text-forest-800 whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}

          {/* CTA */}
          {hasResponded ? (
            <div className="rounded-xl bg-forest-50 border border-forest-200 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-forest-200 p-1.5">
                  <svg className="h-4 w-4 text-forest-700" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="font-body text-sm font-medium text-forest-800">
                  You have already submitted an introduction for this request.
                </p>
              </div>
            </div>
          ) : (
            <Link
              href={`/broker/introduction/new?requestId=${request.id}`}
              className="btn-primary w-full sm:w-auto text-center"
            >
              Submit Introduction
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}

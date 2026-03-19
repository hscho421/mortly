import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { RequestWithIntroductions } from "@/types";

function formatCurrency(val: number | null | undefined) {
  if (val == null) return "--";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function displayLabel(val: string | null | undefined) {
  if (!val) return "--";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex justify-between py-3 border-b border-cream-200 last:border-0">
      <span className="text-body-sm">{label}</span>
      <span className="text-sm font-medium font-body text-forest-800">{value}</span>
    </div>
  );
}

type Props = {
  request: RequestWithIntroductions;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const id = ctx.params?.id as string;

  const request = await prisma.borrowerRequest.findUnique({
    where: { id },
    include: {
      introductions: {
        include: {
          broker: {
            include: {
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
      _count: { select: { introductions: true } },
    },
  });

  if (!request || request.borrowerId !== session.user.id) {
    return { notFound: true };
  }

  return {
    props: {
      request: JSON.parse(JSON.stringify(request)),
    },
  };
};

export default function RequestDetail({
  request,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const introCount = request._count.introductions;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
        <Link
          href="/borrower/dashboard"
          className="mb-8 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to My Requests
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in-up stagger-1">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="heading-lg">
                {displayLabel(request.requestType)} Request
              </h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-body-sm">
              Created {formatDate(request.createdAt as unknown as string)}
            </p>
          </div>

          <Link
            href="/borrower/request/new"
            className="btn-secondary text-sm py-2 px-4"
          >
            + New Request
          </Link>
        </div>

        {/* Broker responses card */}
        <div className="card-elevated mb-8 animate-fade-in-up stagger-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body-sm">Broker Responses</p>
              <p className="font-display text-4xl text-forest-800 mt-1">
                {introCount}
              </p>
            </div>
            {introCount > 0 ? (
              <Link
                href={`/borrower/brokers/${request.id}`}
                className="btn-amber"
              >
                View Broker Introductions
              </Link>
            ) : (
              <span className="text-body-sm text-sage-400">
                Waiting for brokers to respond...
              </span>
            )}
          </div>
        </div>

        {/* Request details */}
        <div className="card-elevated animate-fade-in-up stagger-3">
          <div className="pb-4 mb-2 border-b divider">
            <h2 className="heading-md">
              Request Details
            </h2>
          </div>

          <div>
            <h3 className="text-xs font-semibold font-body text-sage-500 mt-6 mb-2 uppercase tracking-widest">
              Property
            </h3>
            <DetailRow label="Request Type" value={displayLabel(request.requestType)} />
            <DetailRow label="Province" value={request.province || "--"} />
            <DetailRow label="City" value={request.city || "--"} />
            <DetailRow label="Property Type" value={displayLabel(request.propertyType)} />
            <DetailRow
              label="Price Range"
              value={`${formatCurrency(request.priceRangeMin)} - ${formatCurrency(request.priceRangeMax)}`}
            />
            <DetailRow
              label="Down Payment"
              value={request.downPaymentPercent || "--"}
            />

            <h3 className="text-xs font-semibold font-body text-sage-500 mt-8 mb-2 uppercase tracking-widest">
              Financial
            </h3>
            <DetailRow
              label="Household Income"
              value={`${formatCurrency(request.incomeRangeMin)} - ${formatCurrency(request.incomeRangeMax)}`}
            />
            <DetailRow
              label="Employment Type"
              value={displayLabel(request.employmentType)}
            />
            <DetailRow
              label="Credit Score"
              value={displayLabel(request.creditScoreBand)}
            />
            <DetailRow
              label="Existing Debts"
              value={`${formatCurrency(request.debtRangeMin)} - ${formatCurrency(request.debtRangeMax)}`}
            />

            <h3 className="text-xs font-semibold font-body text-sage-500 mt-8 mb-2 uppercase tracking-widest">
              Mortgage Preferences
            </h3>
            <DetailRow
              label="Amount Needed"
              value={`${formatCurrency(request.mortgageAmountMin)} - ${formatCurrency(request.mortgageAmountMax)}`}
            />
            <DetailRow
              label="Preferred Term"
              value={request.preferredTerm || "--"}
            />
            <DetailRow
              label="Preferred Type"
              value={displayLabel(request.preferredType)}
            />
            <DetailRow
              label="Closing Timeline"
              value={request.closingTimeline || "--"}
            />

            {request.notes && (
              <>
                <h3 className="text-xs font-semibold font-body text-sage-500 mt-8 mb-2 uppercase tracking-widest">
                  Additional Notes
                </h3>
                <p className="text-body py-3">{request.notes}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

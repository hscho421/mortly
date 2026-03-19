import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";

const tiers = [
  {
    name: "Basic",
    price: "$49",
    period: "/mo",
    description: "For individual brokers getting started on the platform.",
    features: {
      introductions: "5 per month",
      profile: "Standard listing",
      placement: "Standard",
      badge: false,
      notifications: true,
      leadFilters: false,
      analytics: false,
      accountManager: false,
      teamTools: false,
      support: "Email support",
    },
    cta: "Start with Basic",
    featured: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mo",
    description: "For established brokers looking to scale their pipeline.",
    features: {
      introductions: "20 per month",
      profile: "Enhanced listing",
      placement: "Priority",
      badge: false,
      notifications: true,
      leadFilters: true,
      analytics: false,
      accountManager: false,
      teamTools: false,
      support: "Priority support",
    },
    cta: "Go Pro",
    featured: true,
  },
  {
    name: "Premium",
    price: "$349",
    period: "/mo",
    description: "For top performers and brokerage teams.",
    features: {
      introductions: "Unlimited",
      profile: "Featured listing",
      placement: "Top of results",
      badge: true,
      notifications: true,
      leadFilters: true,
      analytics: true,
      accountManager: true,
      teamTools: true,
      support: "Dedicated manager",
    },
    cta: "Go Premium",
    featured: false,
  },
];

const comparisonRows = [
  { label: "Monthly introductions", key: "introductions" },
  { label: "Profile type", key: "profile" },
  { label: "Search placement", key: "placement" },
  { label: "Featured broker badge", key: "badge" },
  { label: "Borrower notifications", key: "notifications" },
  { label: "Advanced lead filters", key: "leadFilters" },
  { label: "Analytics dashboard", key: "analytics" },
  { label: "Dedicated account manager", key: "accountManager" },
  { label: "Team collaboration tools", key: "teamTools" },
  { label: "Support level", key: "support" },
];

const faqs = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes. You can upgrade or downgrade your plan at any time. When upgrading, the new features take effect immediately and billing is prorated. When downgrading, the change takes effect at the start of your next billing cycle.",
  },
  {
    q: "What counts as an introduction?",
    a: "An introduction is counted when a borrower you expressed interest in chooses to share their contact information with you. You are not charged for expressing interest — only for successful connections.",
  },
  {
    q: "Is there a free trial?",
    a: "We offer a 14-day free trial on the Pro plan so you can experience the full power of MortgageMatch before committing. No credit card required to start.",
  },
  {
    q: "What happens if I use all my introductions?",
    a: "You can purchase additional introductions at $15 each, or upgrade to a higher plan for better per-introduction value. Unused introductions do not roll over to the next month.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes. Annual billing is available at a 20% discount on all plans. Contact our sales team or select annual billing during signup.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. There are no long-term contracts. You can cancel your subscription at any time and your access will continue until the end of your current billing period.",
  },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <svg className="w-5 h-5 text-forest-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : (
      <svg className="w-5 h-5 text-cream-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return <span className="text-sm text-forest-700/80 font-body">{value}</span>;
}

export default function Pricing() {
  return (
    <Layout>
      <Head>
        <title>Pricing — MortgageMatch</title>
        <meta
          name="description"
          content="Simple, transparent pricing for mortgage brokers. Choose the MortgageMatch plan that fits your business."
        />
      </Head>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_30%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <span className="animate-fade-in-up opacity-0 stagger-1 inline-block font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 mb-6">
            Pricing
          </span>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-cream-100 leading-[1.1]">
            Simple, Transparent Pricing
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-6 text-lg text-cream-300/70 leading-relaxed font-body">
            No hidden fees. No long-term contracts. Choose the plan that matches your business goals and scale as you grow.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier, index) => (
              <div
                key={tier.name}
                className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                  tier.featured
                    ? "bg-forest-800 text-cream-100 ring-2 ring-amber-400 relative scale-[1.02]"
                    : "card-elevated"
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-forest-900 text-xs font-bold rounded-full uppercase tracking-wider font-body">
                    Most Popular
                  </div>
                )}
                <h3 className={`font-body text-sm font-semibold uppercase tracking-wider ${tier.featured ? "text-amber-400" : "text-sage-500"}`}>
                  {tier.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`font-display text-5xl ${tier.featured ? "text-cream-100" : "text-forest-800"}`}>
                    {tier.price}
                  </span>
                  <span className={`font-body text-sm ${tier.featured ? "text-cream-300/60" : "text-sage-400"}`}>
                    {tier.period}
                  </span>
                </div>
                <p className={`mt-3 text-sm font-body ${tier.featured ? "text-cream-300/70" : "text-forest-700/60"}`}>
                  {tier.description}
                </p>

                <ul className="mt-8 space-y-3 flex-1">
                  {Object.entries(tier.features).map(([key, value]) => {
                    if (typeof value === "boolean" && !value) return null;
                    const row = comparisonRows.find((r) => r.key === key);
                    const displayValue = typeof value === "boolean" ? row?.label : `${row?.label}: ${value}`;
                    return (
                      <li key={key} className="flex items-start gap-2.5 text-sm font-body">
                        <svg
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tier.featured ? "text-amber-400" : "text-forest-500"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className={tier.featured ? "text-cream-200" : "text-forest-700/80"}>{displayValue}</span>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href="/for-brokers"
                  className={`mt-8 block text-center w-full py-3.5 rounded-lg font-semibold text-sm transition-all duration-300 font-body ${
                    tier.featured
                      ? "bg-amber-400 text-forest-900 hover:bg-amber-300"
                      : "bg-forest-800 text-cream-100 hover:bg-forest-700"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              Compare Plans
            </span>
            <h2 className="heading-lg">Feature Comparison</h2>
            <p className="text-body mt-3">A detailed look at what each plan includes</p>
          </div>

          <div className="animate-fade-in-up opacity-0 stagger-2 overflow-x-auto card-elevated !p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-cream-300">
                  <th className="py-5 pl-6 pr-4 text-sm font-semibold text-forest-800 w-1/3 font-body">Feature</th>
                  {tiers.map((tier) => (
                    <th key={tier.name} className="py-5 px-4 text-center">
                      <span className={`text-sm font-semibold font-body ${tier.featured ? "text-forest-800" : "text-forest-700"}`}>
                        {tier.name}
                      </span>
                      {tier.featured && (
                        <span className="block text-xs text-amber-600 font-body mt-0.5">Recommended</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr key={row.key} className={`border-b border-cream-200 ${index % 2 === 0 ? "bg-cream-50/50" : ""}`}>
                    <td className="py-4 pl-6 pr-4 text-sm text-forest-700/80 font-body">{row.label}</td>
                    {tiers.map((tier) => (
                      <td key={tier.name} className="py-4 px-4 text-center">
                        <CellValue value={tier.features[row.key as keyof typeof tier.features]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              Questions
            </span>
            <h2 className="heading-lg">Pricing FAQ</h2>
          </div>

          <div className="space-y-0">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} border-b border-cream-300 py-8 first:pt-0 last:border-0`}
              >
                <h3 className="heading-sm mb-3">{faq.q}</h3>
                <p className="text-body">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_50%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            Ready to Grow Your Business?
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            Start with a 14-day free trial of the Pro plan. No credit card required.
          </p>
          <Link
            href="/for-brokers"
            className="animate-fade-in-up opacity-0 stagger-2 btn-amber mt-10 px-10 py-4 text-base"
          >
            Start Free Trial
          </Link>
        </div>
      </section>
    </Layout>
  );
}

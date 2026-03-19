import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";

export default function Home() {
  return (
    <Layout>
      <Head>
        <title>MortgageMatch — Find Your Perfect Mortgage Broker Anonymously</title>
        <meta
          name="description"
          content="MortgageMatch is a privacy-first marketplace where borrowers anonymously share their mortgage needs and verified brokers compete to connect with them."
        />
      </Head>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_40%,_theme(colors.amber.400),_transparent_60%)]" />
        <div className="relative section-padding max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-center min-h-[70vh]">
            <div className="lg:col-span-7">
              <div className="animate-fade-in-up opacity-0 stagger-1">
                <span className="inline-block font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 mb-6">
                  Privacy-First Mortgage Marketplace
                </span>
              </div>
              <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-5xl sm:text-6xl lg:text-7xl tracking-tight text-cream-100 leading-[1.05]">
                Find Your Perfect
                <br />
                Mortgage Broker
                <span className="text-amber-400">&mdash;</span>
                <br />
                <em className="text-amber-300">Anonymously</em>
              </h1>
              <p className="animate-fade-in-up opacity-0 stagger-3 mt-8 text-lg text-cream-300/80 leading-relaxed max-w-xl font-body">
                MortgageMatch is the privacy-first marketplace where you describe your mortgage needs without revealing your identity. Verified brokers compete for your business, and you choose who to connect with&nbsp;&mdash; on your terms.
              </p>
              <div className="animate-fade-in-up opacity-0 stagger-4 mt-10 flex flex-col sm:flex-row items-start gap-4">
                <Link href="/borrower/request/new" className="btn-amber px-8 py-4 text-base">
                  Submit Your Request
                </Link>
                <Link href="/for-brokers" className="inline-flex items-center justify-center rounded-lg border-2 border-cream-300/30 px-8 py-4 font-body text-sm font-semibold text-cream-200 transition-all duration-300 hover:bg-cream-100/10 hover:border-cream-300/50 active:scale-[0.98]">
                  I&apos;m a Broker
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5 hidden lg:flex items-center justify-center">
              <div className="animate-scale-in opacity-0 stagger-5 relative">
                <div className="w-72 h-72 rounded-full border border-amber-400/20 flex items-center justify-center">
                  <div className="w-56 h-56 rounded-full border border-cream-300/10 flex items-center justify-center">
                    <div className="w-40 h-40 rounded-full bg-forest-700/50 flex items-center justify-center">
                      <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              The Process
            </span>
            <h2 className="heading-lg">
              Three Simple Steps to Your Ideal Broker
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="card animate-fade-in-up opacity-0 stagger-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                  1
                </div>
                <div className="h-px flex-1 bg-cream-300" />
              </div>
              <h3 className="heading-sm mb-3">Submit Your Request</h3>
              <p className="text-body-sm">
                Describe your mortgage needs anonymously. Share your loan amount, property type, timeline, and preferences without revealing personal details.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card animate-fade-in-up opacity-0 stagger-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                  2
                </div>
                <div className="h-px flex-1 bg-cream-300" />
              </div>
              <h3 className="heading-sm mb-3">Compare Brokers</h3>
              <p className="text-body-sm">
                Verified brokers review your request and express interest. Compare their profiles, reviews, specializations, and proposed approaches side by side.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card animate-fade-in-up opacity-0 stagger-3">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                  3
                </div>
                <div className="h-px flex-1 bg-cream-300" />
              </div>
              <h3 className="heading-sm mb-3">Connect on Your Terms</h3>
              <p className="text-body-sm">
                When you find the right broker, choose to share your contact information. Your identity stays private until you decide to reveal it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-16 items-start">
            <div className="lg:col-span-4 animate-fade-in-up opacity-0">
              <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
                Why MortgageMatch
              </span>
              <h2 className="heading-lg mb-6">
                Built on Trust
              </h2>
              <p className="text-body">
                Your confidence is our foundation. Every aspect of MortgageMatch is designed to protect your privacy and ensure quality.
              </p>
            </div>

            <div className="lg:col-span-8 space-y-6">
              {/* Privacy Shield */}
              <div className="card-elevated animate-fade-in-up opacity-0 stagger-1 flex gap-6">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="heading-sm mb-2">Privacy First</h3>
                  <p className="text-body-sm">
                    Your personal information is never shared without your explicit consent. Browse and compare brokers completely anonymously.
                  </p>
                </div>
              </div>

              {/* Verified Brokers */}
              <div className="card-elevated animate-fade-in-up opacity-0 stagger-2 flex gap-6">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <h3 className="heading-sm mb-2">Verified Brokers</h3>
                  <p className="text-body-sm">
                    Every broker on MortgageMatch is licensed, vetted, and verified. We check credentials and monitor reviews so you can browse with confidence.
                  </p>
                </div>
              </div>

              {/* No Commitment */}
              <div className="card-elevated animate-fade-in-up opacity-0 stagger-3 flex gap-6">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-sage-50 text-sage-600 flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="heading-sm mb-2">No Commitment</h3>
                  <p className="text-body-sm">
                    Explore your options freely. There is no obligation to connect with any broker and no fees for borrowers&nbsp;&mdash; ever.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_50%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            Ready to Find Your Broker?
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            Submit your anonymous request in minutes and let brokers come to you.
          </p>
          <Link
            href="/borrower/request/new"
            className="animate-fade-in-up opacity-0 stagger-2 btn-amber mt-10 px-10 py-4 text-base"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 bg-cream-200/50 border-t border-cream-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-forest-700/50 text-center leading-relaxed font-body">
            <strong>Disclaimer:</strong> MortgageMatch is a marketplace platform that connects borrowers with licensed mortgage brokers. We do not provide mortgage advice, make lending decisions, or act as a lender. All mortgage products and services are offered by independent, licensed brokers. Please consult with a qualified professional before making any financial decisions.
          </p>
        </div>
      </section>
    </Layout>
  );
}

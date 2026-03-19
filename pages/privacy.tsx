import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";

const protections = [
  {
    title: "Anonymous by Default",
    description:
      "When you submit a mortgage request, no personally identifiable information is included. Brokers see your mortgage needs — loan amount, property type, timeline — but never your name, email, phone number, or address.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 2l20 20" />
      </svg>
    ),
  },
  {
    title: "You Control the Connection",
    description:
      "Your identity is only shared when you explicitly choose to connect with a specific broker. Until that moment, you remain completely anonymous. You can browse, compare, and evaluate without any exposure.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    title: "Encrypted Data Storage",
    description:
      "All data at rest is encrypted using AES-256 encryption. Data in transit is protected with TLS 1.3. We follow industry best practices for secure data handling and regularly audit our security infrastructure.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: "No Data Selling",
    description:
      "We never sell your personal data to third parties. Your information is used solely to facilitate connections between you and the brokers you choose. Period.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
];

const dataCollected = [
  {
    category: "Mortgage Request Details",
    items: ["Loan amount and type", "Property type and general location (state/region)", "Timeline and urgency", "Special requirements or preferences"],
    purpose: "Shared anonymously with brokers so they can evaluate if they are a good fit for your needs.",
  },
  {
    category: "Account Information",
    items: ["Email address", "Password (hashed, never stored in plain text)", "Communication preferences"],
    purpose: "Used to manage your account, send notifications, and facilitate connections when you choose to connect.",
  },
  {
    category: "Contact Information",
    items: ["Full name", "Phone number", "Preferred contact method"],
    purpose: "Only shared with a broker when you explicitly choose to connect. Never visible on your public request.",
  },
];

const verificationSteps = [
  {
    step: "1",
    title: "License Verification",
    description: "We verify every broker's NMLS license number and confirm it is active and in good standing with state regulators.",
  },
  {
    step: "2",
    title: "Identity Confirmation",
    description: "Brokers must verify their identity through a secure process that matches their professional credentials.",
  },
  {
    step: "3",
    title: "Background Review",
    description: "We review each broker's professional history, checking for disciplinary actions, complaints, and regulatory issues.",
  },
  {
    step: "4",
    title: "Ongoing Monitoring",
    description: "Verification is not a one-time event. We continuously monitor license status, review borrower feedback, and investigate complaints to maintain marketplace quality.",
  },
];

export default function Privacy() {
  return (
    <Layout>
      <Head>
        <title>Trust &amp; Privacy — MortgageMatch</title>
        <meta
          name="description"
          content="Learn how MortgageMatch protects your privacy, what data we collect, and how our broker verification process works."
        />
      </Head>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_40%_40%,_theme(colors.sage.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <div className="animate-fade-in-up opacity-0 stagger-1 mx-auto w-16 h-16 rounded-full bg-forest-700/50 border border-sage-400/20 text-amber-400 flex items-center justify-center mb-8">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-cream-100 leading-[1.1]">
            Trust &amp; Privacy
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-6 text-lg text-cream-300/70 leading-relaxed max-w-2xl mx-auto font-body">
            Privacy is not just a feature at MortgageMatch — it is the foundation of everything we build. Here is exactly how we protect you.
          </p>
        </div>
      </section>

      {/* How Data Is Protected */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              Our Commitment
            </span>
            <h2 className="heading-lg">How Your Data Is Protected</h2>
            <p className="text-body mt-4">Four pillars of our privacy commitment</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {protections.map((item, index) => (
              <div
                key={item.title}
                className={`card-elevated animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <div className="w-14 h-14 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center mb-6">
                  {item.icon}
                </div>
                <h3 className="heading-sm mb-3">{item.title}</h3>
                <p className="text-body-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Data Is Collected */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              Transparency
            </span>
            <h2 className="heading-lg">What Data We Collect</h2>
            <p className="text-body mt-3">Complete transparency about the information we gather and why</p>
          </div>

          <div className="space-y-6">
            {dataCollected.map((section, index) => (
              <div
                key={section.category}
                className={`card-elevated animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <h3 className="heading-sm mb-5">{section.category}</h3>
                <ul className="space-y-2.5 mb-5">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-forest-700/80 font-body">
                      <span className="w-1.5 h-1.5 bg-forest-500 rounded-full flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="pt-5 border-t border-cream-200">
                  <p className="text-body-sm">
                    <strong className="text-forest-800 font-semibold">Purpose:</strong> {section.purpose}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* When Identity Is Shared */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-16 items-start">
            <div className="lg:col-span-5 animate-fade-in-up opacity-0">
              <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
                Your Control
              </span>
              <h2 className="heading-lg mb-4">When Your Identity Is Shared</h2>
              <p className="text-body">The answer is simple: only when you decide.</p>
            </div>

            <div className="lg:col-span-7">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-6 bottom-6 w-px bg-forest-200" />

                {/* Step: Anonymous */}
                <div className="relative flex gap-6 pb-10 animate-fade-in-up opacity-0 stagger-1">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center z-10 ring-4 ring-cream-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="pt-1">
                    <h3 className="heading-sm mb-1">Submit Request</h3>
                    <p className="text-body-sm">Your identity is <strong className="text-forest-600 font-semibold">completely hidden</strong>. Brokers only see your mortgage requirements.</p>
                  </div>
                </div>

                {/* Step: Still Anonymous */}
                <div className="relative flex gap-6 pb-10 animate-fade-in-up opacity-0 stagger-2">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center z-10 ring-4 ring-cream-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="pt-1">
                    <h3 className="heading-sm mb-1">Review Broker Responses</h3>
                    <p className="text-body-sm">Your identity is <strong className="text-forest-600 font-semibold">still hidden</strong>. Browse and compare brokers freely.</p>
                  </div>
                </div>

                {/* Step: You Choose */}
                <div className="relative flex gap-6 animate-fade-in-up opacity-0 stagger-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center z-10 ring-4 ring-cream-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="pt-1">
                    <h3 className="heading-sm mb-1">You Choose to Connect</h3>
                    <p className="text-body-sm">Only now is your contact information shared — and <strong className="text-amber-700 font-semibold">only with the broker you selected</strong>. No other broker ever sees your details.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Broker Verification */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              Broker Standards
            </span>
            <h2 className="heading-lg">Broker Verification Process</h2>
            <p className="text-body mt-4">
              Every broker on MortgageMatch goes through a rigorous verification process
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {verificationSteps.map((item, index) => (
              <div
                key={item.step}
                className={`card animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)} flex gap-5`}
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                    {item.step}
                  </div>
                </div>
                <div className="pt-1">
                  <h3 className="heading-sm mb-2">{item.title}</h3>
                  <p className="text-body-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 animate-fade-in-up opacity-0 stagger-5 card-elevated !bg-forest-50 border-forest-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-forest-100 text-forest-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="heading-sm mb-1">Report a Concern</h4>
                <p className="text-body-sm">
                  If you ever have a concern about a broker on our platform, contact our trust and safety team. We investigate every report and take action to maintain marketplace integrity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,_theme(colors.sage.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight text-cream-100">
            Your Privacy, Your Control
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            Ready to explore your mortgage options without compromising your privacy?
          </p>
          <Link
            href="/borrower/request/new"
            className="animate-fade-in-up opacity-0 stagger-2 btn-amber mt-10 px-10 py-4 text-base"
          >
            Submit an Anonymous Request
          </Link>
        </div>
      </section>
    </Layout>
  );
}

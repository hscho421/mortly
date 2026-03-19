import Link from "next/link";
import Head from "next/head";
import Layout from "@/components/Layout";

const borrowerSteps = [
  {
    number: "1",
    title: "Create Your Anonymous Request",
    description:
      "Tell us about your mortgage needs — loan amount, property type, location, and timeline. No personal information is required at this stage.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    number: "2",
    title: "Your Request Goes Live",
    description:
      "Your anonymous request is shared with verified brokers in our marketplace. They can see your mortgage needs but never your identity.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    number: "3",
    title: "Brokers Express Interest",
    description:
      "Qualified brokers who specialize in your type of mortgage review your request and indicate their interest in working with you.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    number: "4",
    title: "Review Broker Profiles",
    description:
      "Compare interested brokers side by side. View their experience, specializations, client reviews, and response quality before making any decisions.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    number: "5",
    title: "Choose to Connect",
    description:
      "When you find a broker you like, choose to share your contact information. This is the only point at which your identity is revealed — and only to the broker you select.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    number: "6",
    title: "Work with Your Broker",
    description:
      "Move forward with confidence. After connecting, your broker guides you through the mortgage process. Leave a review to help future borrowers.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

const brokerSteps = [
  {
    number: "1",
    title: "Create Your Broker Profile",
    description:
      "Sign up, verify your license, and build a detailed profile showcasing your experience, specializations, and client testimonials.",
  },
  {
    number: "2",
    title: "Browse Anonymous Requests",
    description:
      "Access a marketplace of anonymous borrower requests filtered by your specialization, geography, and loan type preferences.",
  },
  {
    number: "3",
    title: "Express Interest",
    description:
      "When you see a request that fits your expertise, express interest with a personalized message explaining why you are the right fit.",
  },
  {
    number: "4",
    title: "Borrower Reviews Your Profile",
    description:
      "The borrower compares you against other interested brokers based on your profile, reviews, and the quality of your response.",
  },
  {
    number: "5",
    title: "Get Connected",
    description:
      "If the borrower chooses you, contact information is exchanged and you can begin the consultation process directly.",
  },
];

const faqs = [
  {
    q: "Is MortgageMatch really free for borrowers?",
    a: "Yes. Borrowers never pay a fee to use MortgageMatch. Our revenue comes from subscription plans that brokers pay to access the marketplace.",
  },
  {
    q: "How is my identity protected?",
    a: "Your request is published without any personally identifiable information. Brokers can only see the details of your mortgage needs. Your identity is only revealed when you explicitly choose to connect with a specific broker.",
  },
  {
    q: "What kinds of mortgages can I request?",
    a: "MortgageMatch supports all standard mortgage types including purchase loans, refinancing, home equity loans, investment property loans, jumbo loans, and more.",
  },
  {
    q: "How are brokers verified?",
    a: "Every broker undergoes a multi-step verification process that includes license validation, background checks, and ongoing review monitoring to ensure quality and compliance.",
  },
  {
    q: "Can I receive multiple broker responses?",
    a: "Absolutely. In fact, that is the core value of MortgageMatch. Multiple qualified brokers can express interest in your request, giving you the power to compare and choose the best fit.",
  },
  {
    q: "What if I change my mind?",
    a: "You can withdraw your request or decline any broker at any time. There is no commitment or obligation at any stage of the process.",
  },
];

export default function HowItWorks() {
  return (
    <Layout>
      <Head>
        <title>How It Works — MortgageMatch</title>
        <meta
          name="description"
          content="Learn how MortgageMatch connects borrowers with mortgage brokers through our anonymous, privacy-first marketplace."
        />
      </Head>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-800" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_60%_30%,_theme(colors.sage.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-4xl mx-auto text-center">
          <span className="animate-fade-in-up opacity-0 stagger-1 inline-block font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 mb-6">
            The Process
          </span>
          <h1 className="animate-fade-in-up opacity-0 stagger-2 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight text-cream-100 leading-[1.1]">
            How MortgageMatch Works
          </h1>
          <p className="animate-fade-in-up opacity-0 stagger-3 mt-6 text-lg text-cream-300/70 leading-relaxed max-w-2xl mx-auto font-body">
            A transparent, privacy-first process that puts borrowers in control and helps brokers find qualified clients.
          </p>
        </div>
      </section>

      {/* Borrower Flow */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16 animate-fade-in-up opacity-0">
            <span className="inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-forest-700 bg-forest-100 rounded-full mb-5 font-body">
              For Borrowers
            </span>
            <h2 className="heading-lg">Your Journey to the Right Broker</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {borrowerSteps.map((step, index) => (
              <div
                key={step.number}
                className={`card animate-fade-in-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
              >
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-forest-800 text-amber-400 flex items-center justify-center font-display text-lg">
                      {step.number}
                    </div>
                  </div>
                  <div className="pt-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-forest-600">{step.icon}</span>
                      <h3 className="heading-sm">{step.title}</h3>
                    </div>
                    <p className="text-body-sm">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Broker Flow */}
      <section className="section-padding bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16 animate-fade-in-up opacity-0">
            <span className="inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-amber-700 bg-amber-100 rounded-full mb-5 font-body">
              For Brokers
            </span>
            <h2 className="heading-lg">How Brokers Connect with Clients</h2>
          </div>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-6 top-6 bottom-6 w-px bg-amber-300/40 hidden md:block" />

            <div className="space-y-8">
              {brokerSteps.map((step, index) => (
                <div
                  key={step.number}
                  className={`animate-slide-in-right opacity-0 stagger-${Math.min(index + 1, 6)} relative flex gap-6 md:pl-0`}
                >
                  <div className="flex-shrink-0 relative z-10">
                    <div className="w-12 h-12 rounded-full bg-amber-500 text-forest-900 flex items-center justify-center font-display text-lg">
                      {step.number}
                    </div>
                  </div>
                  <div className="card-elevated flex-1 pt-1">
                    <h3 className="heading-sm mb-2">{step.title}</h3>
                    <p className="text-body-sm">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-cream-100">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up opacity-0">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-4 block">
              Common Questions
            </span>
            <h2 className="heading-lg">Frequently Asked Questions</h2>
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
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_60%,_theme(colors.amber.400),_transparent_50%)]" />
        <div className="relative section-padding max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up opacity-0 font-display text-3xl sm:text-4xl tracking-tight text-cream-100">
            Ready to Get Started?
          </h2>
          <p className="animate-fade-in-up opacity-0 stagger-1 mt-6 text-lg text-cream-300/70 font-body">
            Submit your anonymous request in minutes — it is completely free for borrowers.
          </p>
          <div className="animate-fade-in-up opacity-0 stagger-2 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/borrower/request/new" className="btn-amber px-8 py-4 text-base">
              Submit Your Request
            </Link>
            <Link href="/for-brokers" className="inline-flex items-center justify-center rounded-lg border-2 border-cream-300/30 px-8 py-4 font-body text-sm font-semibold text-cream-200 transition-all duration-300 hover:bg-cream-100/10 hover:border-cream-300/50 active:scale-[0.98]">
              Join as a Broker
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dashboardHref =
    session?.user?.role === "BROKER"
      ? "/broker/dashboard"
      : session?.user?.role === "ADMIN"
        ? "/admin/dashboard"
        : "/borrower/dashboard";

  const publicLinks = [
    { href: "/how-it-works", label: "How It Works" },
    { href: "/for-brokers", label: "For Brokers" },
    { href: "/pricing", label: "Pricing" },
  ];

  const isActive = (href: string) => router.pathname === href;

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-cream-300 bg-cream-100/90 backdrop-blur-lg shadow-sm"
          : "bg-cream-100"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-800 transition-transform duration-300 group-hover:scale-105">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-display text-xl text-forest-800">
              MortgageMatch
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative font-body text-sm font-medium transition-colors duration-200 ${
                  isActive(link.href)
                    ? "text-forest-800"
                    : "text-forest-700/60 hover:text-forest-800"
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-amber-500" />
                )}
              </Link>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <>
                <Link
                  href={dashboardHref}
                  className="font-body text-sm font-medium text-forest-700/60 transition-colors hover:text-forest-800"
                >
                  Dashboard
                </Link>
                {(session.user?.role === "BORROWER" || session.user?.role === "BROKER") && (
                  <Link
                    href={session.user?.role === "BROKER" ? "/broker/messages" : "/borrower/messages"}
                    className={`relative font-body text-sm font-medium transition-colors duration-200 ${
                      isActive("/borrower/messages") || isActive("/broker/messages")
                        ? "text-forest-800"
                        : "text-forest-700/60 hover:text-forest-800"
                    }`}
                  >
                    Messages
                    {(isActive("/borrower/messages") || isActive("/broker/messages")) && (
                      <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-amber-500" />
                    )}
                  </Link>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-lg border border-cream-400 px-4 py-2 font-body text-sm font-medium text-forest-700 transition-all hover:border-forest-300 hover:bg-white"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-body text-sm font-medium text-forest-700/60 transition-colors hover:text-forest-800"
                >
                  Login
                </Link>
                <Link href="/signup" className="btn-primary !py-2.5 !text-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-forest-600 transition-colors hover:bg-cream-200 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-cream-300 bg-cream-100 md:hidden animate-fade-in">
          <div className="space-y-1 px-4 pb-5 pt-4">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-4 py-2.5 font-body text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-forest-50 text-forest-800"
                    : "text-forest-700/70 hover:bg-cream-200 hover:text-forest-800"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <hr className="my-3 border-cream-300" />

            {session ? (
              <>
                <Link
                  href={dashboardHref}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-2.5 font-body text-sm font-medium text-forest-700/70 hover:bg-cream-200"
                >
                  Dashboard
                </Link>
                {(session.user?.role === "BORROWER" || session.user?.role === "BROKER") && (
                  <Link
                    href={session.user?.role === "BROKER" ? "/broker/messages" : "/borrower/messages"}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-lg px-4 py-2.5 font-body text-sm font-medium ${
                      isActive("/borrower/messages") || isActive("/broker/messages")
                        ? "bg-forest-50 text-forest-800"
                        : "text-forest-700/70 hover:bg-cream-200 hover:text-forest-800"
                    }`}
                  >
                    Messages
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="block w-full rounded-lg px-4 py-2.5 text-left font-body text-sm font-medium text-forest-700/70 hover:bg-cream-200"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-2.5 font-body text-sm font-medium text-forest-700/70 hover:bg-cream-200"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block btn-primary mt-2 text-center"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

import posthog from "posthog-js";

// PIPEDA / Quebec Law 25: do not set tracking cookies or capture until the
// visitor consents. We initialize opted-OUT with memory-only persistence so
// nothing is written to storage and no events are sent; the consent banner
// (components/ConsentBanner) flips persistence to localStorage and calls
// posthog.opt_in_capturing() once the visitor accepts. Declining leaves us in
// cookieless memory mode (effectively off across reloads).
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  opt_out_capturing_by_default: true,
  persistence: "memory",
  debug: process.env.NODE_ENV === "development",
});

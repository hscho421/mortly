import { useTranslation } from "next-i18next";
import LiveActivityCard from "./LiveActivityCard";
import type { LiveRequest } from "@/types";

export default function LiveActivityMarquee({ requests }: { requests: LiveRequest[] }) {
  const { t } = useTranslation("common");

  if (requests.length === 0) return null;

  // If fewer than 4 cards, show static centered grid
  if (requests.length < 4) {
    return (
      <section className="section-padding bg-cream-200/40 border-y border-cream-300/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-3 block">
              {t("home.live.title")}
            </span>
            <p className="font-body text-sm text-sage-500">
              {t("home.live.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {requests.map((req) => (
              <LiveActivityCard key={req.key} request={req} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-cream-200/40 border-y border-cream-300/60 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-3 block">
            {t("home.live.title")}
          </span>
          <p className="font-body text-sm text-sage-500">
            {t("home.live.subtitle")}
          </p>
        </div>
      </div>

      {/* Marquee container */}
      <div className="group relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24 bg-gradient-to-r from-cream-200/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24 bg-gradient-to-l from-cream-200/80 to-transparent" />

        {/* Scrolling track */}
        <div
          className="flex gap-4 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:overflow-x-auto motion-reduce:scroll-smooth"
          aria-label={t("home.live.title")}
          style={{ width: "max-content" }}
        >
          {/* Original set */}
          {requests.map((req) => (
            <LiveActivityCard key={req.key} request={req} />
          ))}
          {/* Duplicate for seamless loop */}
          <div aria-hidden="true" className="contents">
            {requests.map((req) => (
              <LiveActivityCard key={`dup-${req.key}`} request={req} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

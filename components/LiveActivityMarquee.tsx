import { useTranslation } from "next-i18next";
import LiveActivityCard from "./LiveActivityCard";
import type { LiveRequest } from "@/types";

export default function LiveActivityMarquee({ requests }: { requests: LiveRequest[] }) {
  const { t } = useTranslation("common");

  if (requests.length === 0) return null;

  const Header = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="eyebrow">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {t("home.live.title")}
            </span>
          </div>
          <h2 className="heading-md mt-3 max-w-2xl">
            {t("home.live.subtitle")}
          </h2>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-sage-500">
          LIVE · {requests.length} OPEN
        </div>
      </div>
    </div>
  );

  // If fewer than 4 cards, show static centered grid
  if (requests.length < 4) {
    return (
      <section className="py-16 lg:py-20 bg-cream-100 border-y border-cream-300">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
    <section className="py-16 lg:py-20 bg-cream-100 border-y border-cream-300 overflow-hidden">
      <Header />

      {/* Marquee container */}
      <div className="group relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24 bg-gradient-to-r from-cream-100 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24 bg-gradient-to-l from-cream-100 to-transparent" />

        {/* Scrolling track */}
        <div
          className="flex gap-4 animate-marquee motion-reduce:animate-none motion-reduce:overflow-x-auto motion-reduce:scroll-smooth"
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

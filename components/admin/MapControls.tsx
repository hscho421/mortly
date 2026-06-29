import { useTranslation } from "next-i18next";

/**
 * MapControls — zoom in / out / reset overlay for the interactive maps.
 * Real <button>s (keyboard-operable) with SVG icons and i18n aria-labels.
 */

const BTN =
  "flex h-8 w-8 items-center justify-center rounded-sm border border-cream-300 bg-white/90 text-forest-700 shadow-sm transition-colors duration-200 hover:bg-cream-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:opacity-40 disabled:cursor-default disabled:hover:bg-white/90";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function MapControls({
  zoomIn,
  zoomOut,
  reset,
  isZoomed,
}: {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  isZoomed: boolean;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
      <button type="button" onClick={zoomIn} aria-label={t("admin.geography.map.zoomIn", "확대")} className={BTN}>
        <Icon>
          <path d="M12 5v14M5 12h14" />
        </Icon>
      </button>
      <button type="button" onClick={zoomOut} aria-label={t("admin.geography.map.zoomOut", "축소")} className={BTN}>
        <Icon>
          <path d="M5 12h14" />
        </Icon>
      </button>
      <button
        type="button"
        onClick={reset}
        disabled={!isZoomed}
        aria-label={t("admin.geography.map.reset", "초기화")}
        className={BTN}
      >
        <Icon>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <circle cx="12" cy="12" r="2.5" />
        </Icon>
      </button>
    </div>
  );
}

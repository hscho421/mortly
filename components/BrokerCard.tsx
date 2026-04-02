import React from "react";
import { useTranslation } from "next-i18next";

interface BrokerCardProps {
  introduction: {
    id: string;
    howCanHelp: string;
    personalMessage: string;
    broker: {
      id: string;
      brokerageName: string;
      yearsExperience?: number | null;
      rating?: number | null;
      verificationStatus: string;
      specialties?: string | null;
      profilePhoto?: string | null;
      mortgageCategory?: string | null;
      user: {
        name?: string | null;
      };
    };
  };
  onSelect: (introductionId: string) => void;
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <svg key={`full-${i}`} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {hasHalf && (
        <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="halfGrad">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="#e0d5c3" />
            </linearGradient>
          </defs>
          <path fill="url(#halfGrad)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <svg key={`empty-${i}`} className="h-4 w-4 text-cream-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1.5 font-body text-sm font-semibold text-forest-700">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function BrokerCard({ introduction, onSelect }: BrokerCardProps) {
  const { t } = useTranslation("common");
  const { broker } = introduction;
  const specialties = broker.specialties
    ? broker.specialties.split(",").map((s) => s.trim())
    : [];

  return (
    <div className="card group">
      {/* Broker header */}
      <div className="flex items-start gap-4">
        {broker.profilePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={broker.profilePhoto}
            alt={broker.user.name || t("misc.broker")}
            className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl object-cover ring-2 ring-cream-200"
          />
        ) : (
          <div className="flex h-10 w-10 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-forest-100 to-sage-100 text-forest-600">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg text-forest-800">
              {broker.user.name || t("misc.broker")}
            </h3>
            {broker.verificationStatus === "VERIFIED" && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-3 w-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
          <p className="font-body text-sm text-sage-500">{broker.brokerageName}</p>
          {broker.yearsExperience != null && (
            <p className="font-body text-xs text-sage-400">
              {t("brokerCard.yearsExperience_other", { count: broker.yearsExperience })}
            </p>
          )}
          {broker.mortgageCategory && (
            <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-body text-[11px] font-medium text-amber-700">
              {broker.mortgageCategory === "RESIDENTIAL"
                ? t("brokerCard.residential")
                : broker.mortgageCategory === "COMMERCIAL"
                  ? t("brokerCard.commercial")
                  : t("brokerCard.residentialCommercial")}
            </span>
          )}
        </div>
      </div>

      {/* Rating */}
      {broker.rating != null && (
        <div className="mt-4">
          <StarRating rating={broker.rating} />
        </div>
      )}

      {/* Specialties */}
      {specialties.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {specialties.map((s) => (
            <span
              key={s}
              className="rounded-full bg-forest-50 px-3 py-1 font-body text-xs font-medium text-forest-700"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* How they can help */}
      <div className="mt-5 rounded-xl bg-cream-50 p-4">
        <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-sage-500">{t("brokerCard.howICanHelp")}</h4>
        <p className="mt-2 font-body text-sm leading-relaxed text-forest-700">{introduction.howCanHelp}</p>
      </div>

      {/* Personal message */}
      <div className="mt-4">
        <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-sage-500">{t("brokerCard.personalMessage")}</h4>
        <p className="mt-2 font-body text-sm italic leading-relaxed text-forest-700/80">
          &ldquo;{introduction.personalMessage}&rdquo;
        </p>
      </div>

      {/* Action */}
      <button
        type="button"
        onClick={() => onSelect(introduction.id)}
        className="btn-primary mt-6 w-full"
      >
        {t("brokerCard.selectThisBroker")}
      </button>
    </div>
  );
}

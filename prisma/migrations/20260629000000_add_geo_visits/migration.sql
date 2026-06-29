-- Cookieless visitor geography (IP-derived, from Vercel edge headers).
CREATE TABLE "geo_visits" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "timezone" TEXT,
    "device" TEXT,
    "referrer" TEXT,
    "path" TEXT,
    "role" TEXT NOT NULL DEFAULT 'anon',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "geo_visits_createdAt_idx" ON "geo_visits"("createdAt");

CREATE INDEX "geo_visits_country_region_idx" ON "geo_visits"("country", "region");

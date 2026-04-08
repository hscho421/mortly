interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-cream-200 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-6 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-cream-200">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="card-stat text-center">
      <Skeleton className="h-9 w-16 mx-auto mb-2" />
      <Skeleton className="h-4 w-24 mx-auto" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(4)].map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonAdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-cream-200 bg-white p-6">
            <Skeleton className="h-3 w-24 mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, j) => (
                <div key={j}>
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-7 w-12" />
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Wide pipeline card */}
        <div className="rounded-2xl border border-cream-200 bg-white p-6 lg:col-span-2">
          <Skeleton className="h-3 w-28 mb-4" />
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {[...Array(7)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-14 mb-2" />
                <Skeleton className="h-8 w-10" />
              </div>
            ))}
          </div>
        </div>
        {/* Wide activity card */}
        <div className="rounded-2xl border border-cream-200 bg-white p-6 lg:col-span-2">
          <Skeleton className="h-3 w-20 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-7 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Queue cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-cream-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center justify-between py-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="rounded-2xl border border-cream-200 bg-white p-6">
        <Skeleton className="h-5 w-36 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />
        <Skeleton className="h-60 w-full" />
      </div>
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      {/* Form fields */}
      <div className="rounded-2xl border border-cream-200 bg-white p-6 space-y-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonRequestDetail() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Skeleton className="h-5 w-32 mb-6" />
      <div className="rounded-2xl border border-cream-200 bg-white p-6 space-y-5 mb-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      {/* Broker responses */}
      <Skeleton className="h-6 w-40 mb-4" />
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-cream-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonRequestList() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header + filters */}
      <div className="mb-8 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonBilling() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-72" />
      </div>
      {/* Current plan */}
      <div className="rounded-2xl border border-cream-200 bg-white p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-cream-200 bg-white p-6 space-y-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-10 w-24" />
            <div className="space-y-2 pt-4 border-t border-cream-200">
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonBrokerList() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Skeleton className="h-5 w-32 mb-2" />
      <Skeleton className="h-7 w-64 mb-8" />
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-cream-200 bg-white p-6">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3 mt-2" />
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Skeleton className="h-8 w-56 mb-2" />
      <Skeleton className="h-5 w-72 mb-8" />
      <div className="rounded-2xl border border-cream-200 bg-white p-6 space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonChat() {
  return (
    <div className="flex" style={{ height: "calc(100vh - 80px)" }}>
      {/* Sidebar */}
      <div className="w-80 border-r border-cream-300 p-4 space-y-4 hidden md:block">
        <Skeleton className="h-8 w-32 mb-6" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      {/* Main */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          <Skeleton className="h-5 w-48 mx-auto" />
          <Skeleton className="h-4 w-36 mx-auto" />
        </div>
      </div>
    </div>
  );
}

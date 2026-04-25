interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-cream-200 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-sm border border-cream-300 bg-cream-50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="h-7 w-44" />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-cream-200">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-sm border border-cream-300 bg-cream-50 p-6">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-10 w-16" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Editorial header — eyebrow + serif title + subtitle + action */}
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Stat cards */}
      <div className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      {/* Editorial header */}
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Action-required inbox box (prominent bordered block) */}
      <div className="mb-8 rounded-sm border-2 border-forest-800 bg-cream-50">
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-300">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`grid grid-cols-[90px_110px_1fr_auto] gap-4 items-center px-5 py-4 ${i !== 0 ? "border-t border-cream-200" : ""}`}
          >
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-3 w-20" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Stats cards — editorial (mono label + big serif number) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-sm border border-cream-300 bg-cream-50 p-7">
            <Skeleton className="h-3 w-24 mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-14" />
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Wide pipeline card */}
        <div className="rounded-sm border border-cream-300 bg-cream-50 p-7 lg:col-span-2">
          <Skeleton className="h-3 w-28 mb-4" />
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))}
          </div>
        </div>
        {/* Wide activity card */}
        <div className="rounded-sm border border-cream-300 bg-cream-50 p-7 lg:col-span-2">
          <Skeleton className="h-3 w-20 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="rounded-sm border border-cream-300 bg-cream-50 p-7">
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {/* Editorial header */}
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      {/* Form fields */}
      <div className="rounded-sm border border-cream-300 bg-cream-50 p-7 space-y-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function SkeletonRequestDetail() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Skeleton className="h-4 w-32 mb-6" />
      <div className="rounded-sm border border-cream-300 bg-cream-50 p-7 space-y-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-56" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="h-px bg-cream-300" />
        <div className="grid grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
      {/* Broker responses */}
      <div className="mb-4 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-sm border border-cream-300 bg-cream-50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-11 w-11 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-24" />
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
      {/* Editorial header + filters */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-52" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-6 pb-4 border-b border-cream-300">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-16" />
        ))}
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
      {/* Editorial header */}
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      {/* Current plan */}
      <div className="rounded-sm border border-cream-300 bg-cream-50 p-7 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-3 w-28 ml-auto" />
            <Skeleton className="h-10 w-14 ml-auto" />
          </div>
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-sm border border-cream-300 bg-cream-50 p-7 space-y-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-4 w-full" />
            <div className="h-px bg-cream-300" />
            <div className="space-y-2.5">
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonBrokerList() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Editorial header */}
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-sm border border-cream-300 bg-cream-50 p-6">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="h-px bg-cream-300 my-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3 mt-2" />
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
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
      {/* Editorial header */}
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="rounded-sm border border-cream-300 bg-cream-50 p-7 space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

export function SkeletonChat() {
  return (
    <div className="flex" style={{ height: "calc(100vh - 80px)" }}>
      {/* Sidebar */}
      <div className="w-80 border-r border-cream-300 bg-cream-50 hidden md:flex md:flex-col">
        <div className="p-5 border-b border-cream-300 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="p-3 space-y-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Main */}
      <div className="flex-1 flex items-center justify-center bg-cream-100">
        <div className="text-center space-y-3">
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          <Skeleton className="h-5 w-48 mx-auto" />
          <Skeleton className="h-4 w-36 mx-auto" />
        </div>
      </div>
    </div>
  );
}

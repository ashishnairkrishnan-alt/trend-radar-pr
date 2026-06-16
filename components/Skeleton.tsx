export function TrendCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-card overflow-hidden border-l-[3px] border-pr-muted/20 animate-pulse">
      <div className="p-5">
        {/* Platform badge + spike */}
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-8 rounded bg-pr-bg" />
          <div className="h-6 w-14 rounded-md bg-pr-bg" />
        </div>

        {/* Title */}
        <div className="h-6 w-3/4 rounded bg-pr-bg mb-1.5" />
        <div className="h-4 w-1/2 rounded bg-pr-bg mb-4" />

        {/* Emotional hook */}
        <div className="space-y-1.5 mb-4">
          <div className="h-3 w-full rounded bg-pr-bg" />
          <div className="h-3 w-5/6 rounded bg-pr-bg" />
        </div>

        {/* Score bars */}
        <div className="bg-pr-bg rounded-lg p-3 mb-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="flex justify-between mb-1">
                <div className="h-2.5 w-20 rounded bg-white/60" />
                <div className="h-2.5 w-8 rounded bg-white/60" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/60" />
            </div>
          ))}
        </div>

        {/* Bottom pills */}
        <div className="h-7 w-24 rounded-full bg-pr-bg mb-3" />
        <div className="h-4 w-full rounded bg-pr-bg mb-1" />
        <div className="h-4 w-4/5 rounded bg-pr-bg mb-4" />
        <div className="h-7 w-36 rounded-full bg-pr-bg" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div>
      {/* Filter row skeleton */}
      <div className="flex gap-2 mb-6 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-white shadow-sm" />
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <TrendCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

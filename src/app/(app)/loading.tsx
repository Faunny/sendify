// Global loading UI for the (app) route group. Shown the instant any nav
// link is clicked, then replaced by the real page once its server work
// (DB queries, etc.) finishes. Massive perceived-speed win — without this,
// the browser sits on the previous page until the new one is fully ready.

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-56 rounded bg-secondary/60 animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-secondary/40 animate-pulse" />
      </div>
      {/* Action row skeleton */}
      <div className="flex gap-2">
        <div className="h-9 w-32 rounded bg-secondary/50 animate-pulse" />
        <div className="h-9 w-24 rounded bg-secondary/40 animate-pulse" />
      </div>
      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border border-border bg-card/30 p-4 space-y-2">
            <div className="h-4 w-2/3 rounded bg-secondary/50 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-secondary/40 animate-pulse" />
            <div className="h-8 w-full rounded bg-secondary/30 animate-pulse mt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

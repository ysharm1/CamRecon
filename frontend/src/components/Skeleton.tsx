/**
 * Reusable skeleton primitives. Match the shape of real content so layouts
 * don't jump when data arrives.
 */

interface BaseProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: BaseProps) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} aria-hidden="true" />;
}

export function SkeletonText({ width = 'w-full', className = '' }: { width?: string; className?: string }) {
  return <SkeletonBlock className={`h-3 ${width} ${className}`} />;
}

export function SkeletonMetricCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <SkeletonText width="w-24" />
          <SkeletonBlock className="h-7 w-32" />
        </div>
        <SkeletonBlock className="h-12 w-12 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonText key={i} width="w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: columns }).map((_, c) => (
                <SkeletonText key={c} width={c === 0 ? 'w-3/4' : 'w-1/2'} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-white p-3">
      <SkeletonBlock className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <SkeletonText width="w-2/3" />
        <SkeletonText width="w-1/3" />
      </div>
    </div>
  );
}

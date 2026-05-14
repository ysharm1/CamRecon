interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className = '' }: SkeletonCardProps) {
  return (
    <div className={`animate-pulse rounded-lg border border-gray-200 bg-white p-6 ${className}`} aria-hidden="true">
      <div className="h-4 w-3/4 rounded bg-gray-200 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded bg-gray-200 mb-3 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

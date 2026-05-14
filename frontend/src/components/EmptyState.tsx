import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  variant?: 'card' | 'plain';
}

/**
 * Thoughtful empty state with an icon, title, description, and optional CTA.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
  variant = 'card',
}: EmptyStateProps) {
  const wrapperClass =
    variant === 'card'
      ? 'rounded-lg border border-dashed border-gray-300 bg-white'
      : '';

  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${wrapperClass} ${className}`}
    >
      <div className="rounded-full bg-gray-100 p-3">
        <Icon className="h-6 w-6 text-gray-500" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

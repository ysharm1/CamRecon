import { ReactNode } from 'react';
import { Search, X, LucideIcon } from 'lucide-react';

export interface IndexHeaderActiveFilter {
  label: string;
  onRemove: () => void;
}

export interface IndexHeaderProps {
  title: string;
  description?: string;
  /** Total count to display next to the title, e.g. "Properties · 24" */
  count?: number;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryActions?: ReactNode;
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  /** Filter dropdowns rendered inline next to search */
  filters?: ReactNode;
  /** Active filter chips with X to remove */
  activeFilters?: IndexHeaderActiveFilter[];
  /** Optional sort controls (rendered with filters) */
  sort?: ReactNode;
  /** Result count line, e.g. "Showing 5 of 24" */
  resultLabel?: string;
  /** Set sticky positioning for the toolbar */
  sticky?: boolean;
}

/**
 * Standard list-page header. Renders title + description + primary action,
 * a filter/search toolbar, and active filter chips.
 */
export function IndexHeader({
  title,
  description,
  count,
  primaryAction,
  secondaryActions,
  search,
  filters,
  activeFilters,
  sort,
  resultLabel,
  sticky,
}: IndexHeaderProps) {
  const PrimaryIcon = primaryAction?.icon;

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
            {typeof count === 'number' && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                {count.toLocaleString()}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {PrimaryIcon && <PrimaryIcon className="h-4 w-4" />}
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: search + filters */}
      {(search || filters || sort) && (
        <div
          className={`flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center ${
            sticky ? 'sticky top-0 z-10' : ''
          }`}
        >
          {search && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? 'Search...'}
                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
          {(filters || sort) && (
            <div className="flex flex-wrap items-center gap-2">
              {filters}
              {sort}
            </div>
          )}
        </div>
      )}

      {/* Active filter chips + result count */}
      {(activeFilters && activeFilters.length > 0) || resultLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters?.map((chip, idx) => (
              <button
                key={`${chip.label}-${idx}`}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                {chip.label}
                <X className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
          </div>
          {resultLabel && (
            <p className="text-xs text-gray-500">{resultLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem } from './Breadcrumb';

export type StatusTone = 'success' | 'warning' | 'error' | 'neutral' | 'info';

export interface DetailHeaderStatus {
  label: string;
  tone: StatusTone;
}

export interface RecordSwitcherItem {
  id: string;
  label: string;
}

export interface RecordSwitcher {
  items: RecordSwitcherItem[];
  currentId: string;
  onSelect: (id: string) => void;
}

export type IconColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'gray';

export interface DetailHeaderProps {
  breadcrumb: BreadcrumbItem[];
  icon: LucideIcon;
  iconColor?: IconColor;
  title: string;
  subtitle?: ReactNode;
  status?: DetailHeaderStatus;
  recordSwitcher?: RecordSwitcher;
  /** Right-rail action buttons */
  actions?: ReactNode;
  /** Quick actions bar that sticks below header (Property: + Tenant, etc) */
  stickyActions?: ReactNode;
}

const ICON_COLOR_CLASSES: Record<IconColor, { bg: string; fg: string }> = {
  indigo: { bg: 'bg-indigo-50', fg: 'text-indigo-600' },
  emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-600' },
  rose: { bg: 'bg-rose-50', fg: 'text-rose-600' },
  sky: { bg: 'bg-sky-50', fg: 'text-sky-600' },
  violet: { bg: 'bg-violet-50', fg: 'text-violet-600' },
  gray: { bg: 'bg-gray-100', fg: 'text-gray-600' },
};

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  neutral: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-700',
};

/**
 * Standard detail-page header used across Property / Tenant / Document /
 * Reconciliation detail views. Includes breadcrumb, icon-and-title row,
 * inline status badge, optional record switcher, and quick actions.
 */
export function DetailHeader({
  breadcrumb,
  icon: Icon,
  iconColor = 'indigo',
  title,
  subtitle,
  status,
  recordSwitcher,
  actions,
  stickyActions,
}: DetailHeaderProps) {
  const iconClasses = ICON_COLOR_CLASSES[iconColor];

  return (
    <div className="space-y-4">
      {/* Breadcrumb + record switcher row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={breadcrumb} />
        {recordSwitcher && <RecordSwitcherControl switcher={recordSwitcher} />}
      </div>

      {/* Title row */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`rounded-full p-2 ${iconClasses.bg}`}>
            <Icon className={`h-6 w-6 ${iconClasses.fg}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-gray-900 truncate">
                {title}
              </h2>
              {status && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_TONE_CLASSES[status.tone]}`}
                >
                  {status.label}
                </span>
              )}
            </div>
            {subtitle && (
              <div className="mt-1 text-sm text-gray-500">{subtitle}</div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Sticky quick actions bar (optional) */}
      {stickyActions && (
        <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          {stickyActions}
        </div>
      )}
    </div>
  );
}

function RecordSwitcherControl({ switcher }: { switcher: RecordSwitcher }) {
  const { items, currentId, onSelect } = switcher;
  const idx = items.findIndex((i) => i.id === currentId);
  const prev = idx > 0 ? items[idx - 1] : null;
  const next = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null;

  if (items.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white text-xs">
      <button
        type="button"
        disabled={!prev}
        onClick={() => prev && onSelect(prev.id)}
        title={prev ? `Previous: ${prev.label}` : 'No previous record'}
        className="inline-flex items-center gap-1 rounded-l-md px-2 py-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Previous
      </button>
      <span className="border-l border-gray-200 px-2 py-1.5 text-gray-500">
        {idx >= 0 ? `${idx + 1} of ${items.length}` : `${items.length}`}
      </span>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && onSelect(next.id)}
        title={next ? `Next: ${next.label}` : 'No next record'}
        className="inline-flex items-center gap-1 rounded-r-md border-l border-gray-200 px-2 py-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
      >
        Next
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

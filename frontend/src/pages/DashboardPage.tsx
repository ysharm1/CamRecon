import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  AlertTriangle,
  Brain,
  Activity,
  Calculator,
  ArrowRight,
  Sparkles,
  FileWarning,
  LucideIcon,
} from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { useRecentActivity } from '@/hooks/useActivity';
import { useProperties } from '@/hooks/useProperties';
import { useRenewalRisks } from '@/hooks/useAI';
import { SkeletonMetricCard, SkeletonListRow } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import type { RenewalRisk } from '@/hooks/useAI';

/**
 * Dashboard. Single-purpose: drive the user toward the CAM workflow.
 *
 * Layout:
 *   Top row: 3 action cards (expiring leases, pending abstractions, pending recons)
 *   Main row: Start a Reconciliation (left)   Recent Activity (right)
 */
export function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();
  const { data: activity, isLoading: activityLoading } = useRecentActivity(12);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-red-500" />
        <p className="mt-2 text-sm font-medium text-red-700">Failed to load dashboard data.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  // Compute counts from the dashboard payload (fallbacks to 0 during load).
  const expiringLeasesCount = data?.leaseExpirations.within90Days ?? 0;
  const pendingReconsCount = data?.pendingReconciliations.length ?? 0;
  const pendingAbstractionsCount = data?.overdueDocuments.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          What needs your attention, and the fastest way to get it done.
        </p>
      </div>

      {/* Top row: 3 action cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ActionCard
            icon={Clock}
            tone="amber"
            label="Expiring leases"
            sublabel="Next 90 days"
            count={expiringLeasesCount}
            href="/tenants?filter=expiring"
          />
          <ActionCard
            icon={Brain}
            tone="indigo"
            label="Pending abstractions"
            sublabel="Needs AI review"
            count={pendingAbstractionsCount}
            href="/abstractions"
          />
          <ActionCard
            icon={Calculator}
            tone="blue"
            label="Pending reconciliations"
            sublabel="Draft or in-progress"
            count={pendingReconsCount}
            href="/reconciliations"
          />
        </div>
      )}

      {/* Main two-column area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <RenewalRisksCard />
          <StartReconciliationCard />
        </div>
        <div className="lg:col-span-2">
          <RecentActivityCard activity={activity ?? []} isLoading={activityLoading} />
        </div>
      </div>
    </div>
  );
}

// ---------- Action cards ----------

function ActionCard({
  icon: Icon,
  tone,
  label,
  sublabel,
  count,
  href,
}: {
  icon: LucideIcon;
  tone: 'amber' | 'indigo' | 'blue';
  label: string;
  sublabel: string;
  count: number;
  href: string;
}) {
  const toneMap: Record<string, { bg: string; text: string; ring: string }> = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'hover:ring-amber-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'hover:ring-indigo-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'hover:ring-blue-200' },
  };
  const colors = toneMap[tone];

  return (
    <Link
      to={href}
      className={`group block rounded-lg border border-gray-200 bg-white p-5 transition-all hover:shadow-md hover:ring-1 ${colors.ring}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
          <p className={`mt-2 text-3xl font-semibold ${count > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
            {count}
          </p>
          <p className="mt-1 text-xs text-gray-500">{sublabel}</p>
        </div>
        <div className={`rounded-full p-2.5 ${colors.bg}`}>
          <Icon className={`h-5 w-5 ${colors.text}`} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
        View all
        <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

// ---------- Start a Reconciliation (big CTA) ----------

function StartReconciliationCard() {
  const { data: properties } = useProperties();
  const { open } = useGlobalUI();
  const navigate = useNavigate();

  function handleStart(propertyId?: string) {
    open('quickAddReconciliation', propertyId ? { quickAddReconciliation: { propertyId } } : undefined);
  }

  const hasProperties = (properties?.length ?? 0) > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-600 p-2.5 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Start a reconciliation</h3>
          <p className="mt-0.5 text-sm text-gray-600">
            Pick a property and period. Paste your expenses. Get per-tenant
            allocations in minutes.
          </p>
        </div>
      </div>

      {hasProperties ? (
        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="dash-prop" className="text-xs font-medium text-gray-500">
              Jump straight in with:
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(properties ?? []).slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleStart(p.id)}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {p.name}
                </button>
              ))}
              {(properties ?? []).length > 3 && (
                <button
                  type="button"
                  onClick={() => navigate('/properties')}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-300"
                >
                  + {(properties ?? []).length - 3} more
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleStart()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:w-auto"
          >
            <Calculator className="h-4 w-4" />
            Start a new reconciliation
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <EmptyState
          icon={Calculator}
          title="Add a property to get started"
          description="Reconciliations need at least one property with tenants."
          action={
            <Link
              to="/properties"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Go to properties
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
          variant="plain"
        />
      )}
    </div>
  );
}

// ---------- Renewal Risks ----------

function RenewalRisksCard() {
  const { data, isLoading } = useRenewalRisks();
  const risks = data?.risks ?? [];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-900">Renewal risks</h3>
        </div>
        <div className="space-y-2">
          <SkeletonListRow />
          <SkeletonListRow />
        </div>
      </div>
    );
  }

  if (risks.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h3 className="text-sm font-semibold text-gray-900">Renewal risks</h3>
        <span className="ml-auto text-xs text-gray-400">Expiring leases within 90 days</span>
      </div>

      <div className="space-y-3">
        {risks.map((risk: RenewalRisk) => (
          <div
            key={risk.tenantId}
            className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <RiskBadge status={risk.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  to={`/tenants/${risk.tenantId}`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  {risk.tenantName}
                </Link>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{risk.propertyName}</span>
              </div>
              <p className="mt-0.5 text-xs text-gray-600">{risk.message}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Expires {new Date(risk.expirationDate).toLocaleDateString()} ({risk.daysUntilExpiry} days)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskBadge({ status }: { status: 'missed' | 'urgent' | 'upcoming' }) {
  const config = {
    missed: { bg: 'bg-red-100 text-red-700', label: 'MISSED' },
    urgent: { bg: 'bg-orange-100 text-orange-700', label: 'URGENT' },
    upcoming: { bg: 'bg-yellow-100 text-yellow-700', label: 'UPCOMING' },
  };
  const { bg, label } = config[status];
  return (
    <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${bg}`}>
      {label}
    </span>
  );
}

// ---------- Recent Activity ----------

function RecentActivityCard({
  activity,
  isLoading,
}: {
  activity: { id: string; description: string; action: string; created_at: string }[];
  isLoading: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-purple-600" />
        <h3 className="text-sm font-semibold text-gray-900">Recent activity</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </div>
      ) : activity.length > 0 ? (
        <ul className="space-y-3">
          {activity.slice(0, 8).map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 text-sm">
              <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-gray-800">{entry.description}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {formatRelative(entry.created_at)} · {entry.action.replace(/_/g, ' ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={FileWarning}
          title="No activity yet"
          description="Actions across your portfolio will appear here."
          variant="plain"
        />
      )}
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  FileText,
  Activity as ActivityIcon,
  Upload,
  Plus,
  Calculator,
  TrendingUp,
  Clock,
  DollarSign,
  CalendarClock,
  LucideIcon,
} from 'lucide-react';
import { useProperties, useProperty, usePropertyActivity } from '@/hooks/useProperties';
import { useReconciliations } from '@/hooks/useReconciliations';
import { useTenants } from '@/hooks/useTenants';
import { SkeletonMetricCard, SkeletonListRow } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { DetailHeader } from '@/components/DetailHeader';
import { KPICard } from '@/components/KPICard';
import { useGlobalUI } from '@/hooks/useCommandPalette';

type Tab = 'overview' | 'documents' | 'tenants' | 'reconciliations' | 'activity';

const RENT_PER_SQFT_PER_YEAR_CENTS = 3500; // $35/sqft/year — fallback estimate

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading, error, refetch } = useProperty(id || '');
  const { data: allProperties } = useProperties();
  const { data: tenantList } = useTenants(id || undefined);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { open } = useGlobalUI();
  const navigate = useNavigate();
  const { data: activities } = usePropertyActivity(id || '');
  const { data: reconciliations } = useReconciliations(id || '');

  const metrics = useMemo(() => {
    if (!property) return null;
    const tenants = property.tenants || [];
    const activeTenants = tenants.filter((t) => t.status === 'active');
    const occupiedArea = activeTenants.reduce((sum, t) => sum + t.squareFootage, 0);
    const occupancyRate = property.totalSquareFootage > 0 ? occupiedArea / property.totalSquareFootage : 0;

    // Estimated total annual rent — based on occupied area at standard rate.
    // (Backend doesn't currently expose per-tenant base rent on property detail.)
    const annualRentCents = occupiedArea * RENT_PER_SQFT_PER_YEAR_CENTS;

    // Expiring within 90 days — derived from tenants' lease info if present.
    // The /properties/:id endpoint doesn't include lease data so we use the
    // tenants list (filtered by propertyId) when available.
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const expiringSoon = (tenantList || []).filter((t) => {
      const exp = (t as { lease?: { expirationDate?: string } }).lease?.expirationDate;
      if (!exp) return false;
      const ms = new Date(exp).getTime() - Date.now();
      return ms > 0 && ms <= ninetyDays;
    }).length;

    const lastReconciliation = reconciliations && reconciliations.length > 0 ? reconciliations[0] : null;

    return {
      totalTenants: tenants.length,
      activeTenants: activeTenants.length,
      documents: property.documents?.length ?? 0,
      occupancyRate,
      occupiedArea,
      annualRentCents,
      expiringSoon,
      lastReconciliation,
    };
  }, [property, tenantList, reconciliations]);

  // Sibling list for record switcher (alphabetical)
  const siblings = useMemo(() => {
    if (!allProperties) return [];
    return allProperties
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, label: p.name }));
  }, [allProperties]);

  if (error) {
    return (
      <EmptyState
        icon={Building2}
        title="Couldn't load property"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Try again
            </button>
            <Link
              to="/properties"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to properties
            </Link>
          </div>
        }
      />
    );
  }

  if (isLoading || !property) {
    return (
      <div className="space-y-6">
        <SkeletonMetricCard />
        <div className="grid gap-4 sm:grid-cols-4">
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: LucideIcon; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'tenants', label: 'Tenants', icon: Users, count: metrics?.totalTenants },
    { key: 'documents', label: 'Documents', icon: FileText, count: metrics?.documents },
    { key: 'reconciliations', label: 'Reconciliations', icon: Calculator, count: reconciliations?.length },
    { key: 'activity', label: 'Activity', icon: ActivityIcon, count: activities?.length },
  ];

  const occupancyTone =
    metrics && metrics.occupancyRate >= 0.9
      ? 'success'
      : metrics && metrics.occupancyRate >= 0.7
        ? 'warning'
        : 'error';

  return (
    <div className="space-y-6">
      <DetailHeader
        breadcrumb={[
          { label: 'Properties', href: '/properties' },
          { label: property.name },
        ]}
        icon={Building2}
        iconColor="indigo"
        title={property.name}
        subtitle={
          <span className="capitalize">
            {property.propertyType} · {property.totalSquareFootage.toLocaleString()} sqft
            {property.address ? ` · ${property.address.city}, ${property.address.state}` : ''}
          </span>
        }
        status={
          metrics
            ? {
                label: `${(metrics.occupancyRate * 100).toFixed(0)}% occupied`,
                tone: occupancyTone,
              }
            : undefined
        }
        recordSwitcher={
          siblings.length > 1
            ? {
                items: siblings,
                currentId: property.id,
                onSelect: (newId) => navigate(`/properties/${newId}`),
              }
            : undefined
        }
        actions={
          <>
            <QuickBtn
              icon={Upload}
              label="+ Document"
              onClick={() => open('upload', { upload: { propertyId: property.id } })}
            />
            <QuickBtn
              icon={Plus}
              label="+ Tenant"
              onClick={() => open('quickAddTenant', { quickAddTenant: { propertyId: property.id } })}
            />
            <QuickBtn
              icon={Calculator}
              label="+ Reconciliation"
              onClick={() =>
                open('quickAddReconciliation', {
                  quickAddReconciliation: { propertyId: property.id },
                })
              }
              primary
            />
          </>
        }
      />

      {/* KPI snapshot row */}
      {metrics && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KPICard
            label="Annual rent"
            icon={DollarSign}
            value={formatCurrency(metrics.annualRentCents)}
            hint="Estimated"
          />
          <KPICard
            label="Occupancy"
            icon={TrendingUp}
            value={`${(metrics.occupancyRate * 100).toFixed(0)}%`}
            hint={`${metrics.occupiedArea.toLocaleString()} / ${property.totalSquareFootage.toLocaleString()} sqft`}
          />
          <KPICard
            label="Active tenants"
            icon={Users}
            value={metrics.activeTenants.toString()}
            hint={
              metrics.totalTenants > metrics.activeTenants
                ? `${metrics.totalTenants - metrics.activeTenants} inactive`
                : undefined
            }
          />
          <KPICard
            label="Expiring (90d)"
            icon={CalendarClock}
            value={metrics.expiringSoon.toString()}
            hint={metrics.expiringSoon === 0 ? 'No upcoming' : 'Leases expiring soon'}
          />
          <KPICard
            label="Last reconciliation"
            icon={Calculator}
            value={
              metrics.lastReconciliation
                ? `${metrics.lastReconciliation.periodStart} — ${metrics.lastReconciliation.periodEnd}`
                : '—'
            }
            hint={metrics.lastReconciliation ? metrics.lastReconciliation.status : 'None yet'}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {typeof tab.count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    activeTab === tab.key
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab property={property} />}
      {activeTab === 'documents' && (
        <DocumentsTab
          documents={property.documents || []}
          onUpload={() => open('upload', { upload: { propertyId: property.id } })}
          onOpen={(docId) => navigate(`/documents/${docId}`)}
        />
      )}
      {activeTab === 'tenants' && (
        <TenantsTab
          tenants={property.tenants || []}
          onAddTenant={() => open('quickAddTenant', { quickAddTenant: { propertyId: property.id } })}
        />
      )}
      {activeTab === 'reconciliations' && (
        <ReconciliationsTab propertyId={property.id} reconciliations={reconciliations ?? []} />
      )}
      {activeTab === 'activity' && <ActivityTab propertyId={property.id} />}
    </div>
  );
}

// --- Helpers ---

function formatCurrency(cents: number) {
  if (!cents) return '$0';
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function QuickBtn({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
        primary
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// --- Tabs ---

function OverviewTab({
  property,
}: {
  property: {
    name: string;
    address: { street: string; city: string; state: string; zip: string };
    totalSquareFootage: number;
    propertyType: string;
    tenants?: { id: string; name: string; squareFootage: number; status: string }[];
  };
}) {
  const tenants = property.tenants || [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-medium text-gray-900">Address</h4>
        <p className="text-sm text-gray-700">
          {property.address.street}
          <br />
          {property.address.city}, {property.address.state} {property.address.zip}
        </p>
      </div>

      {tenants.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h4 className="text-sm font-medium text-gray-900">Tenant summary</h4>
          </div>
          <ul className="divide-y divide-gray-100">
            {tenants.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <Link to={`/tenants/${t.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                  {t.name}
                </Link>
                <span className="text-gray-500">{t.squareFootage.toLocaleString()} sqft</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DocumentsTab({
  documents,
  onUpload,
  onOpen,
}: {
  documents: { id: string; title: string; documentType: string; currentVersion: number; createdAt: string }[];
  onUpload: () => void;
  onOpen: (id: string) => void;
}) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Upload leases, CAM reports, or insurance certificates."
        action={
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Upload className="h-4 w-4" />
            Upload a document
          </button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Version</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {documents.map((doc) => (
            <tr key={doc.id} className="cursor-pointer hover:bg-gray-50" onClick={() => onOpen(doc.id)}>
              <td className="px-4 py-3 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                {doc.title}
              </td>
              <td className="px-4 py-3 text-sm capitalize text-gray-700">
                {doc.documentType.replace('_', ' ')}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">v{doc.currentVersion}</td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(doc.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantsTab({
  tenants,
  onAddTenant,
}: {
  tenants: { id: string; name: string; contactEmail: string; suiteNumber: string; squareFootage: number; status: string }[];
  onAddTenant: () => void;
}) {
  if (tenants.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No tenants yet"
        description="Add a tenant to start tracking their lease and CAM allocations."
        action={
          <button
            type="button"
            onClick={onAddTenant}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add tenant
          </button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Suite</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Area</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {tenants.map((tenant) => (
            <tr key={tenant.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  to={`/tenants/${tenant.id}`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  {tenant.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">{tenant.suiteNumber}</td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {tenant.squareFootage.toLocaleString()} sqft
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={tenant.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        colors[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status}
    </span>
  );
}

function ReconciliationsTab({
  propertyId,
  reconciliations,
}: {
  propertyId: string;
  reconciliations: { id: string; propertyName?: string; periodStart: string; periodEnd: string; status: string; totalActualCosts: number; createdAt: string }[];
}) {
  const navigate = useNavigate();

  if (reconciliations.length === 0) {
    return (
      <EmptyState
        icon={Calculator}
        title="No reconciliations yet"
        description="Run a CAM reconciliation to allocate expenses across tenants for this property."
        action={
          <Link
            to={`/reconciliations?propertyId=${propertyId}`}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Calculator className="h-4 w-4" />
            New reconciliation
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Period</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Total</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {reconciliations.map((rec) => (
            <tr
              key={rec.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/reconciliations?created=${rec.id}`)}
            >
              <td className="px-4 py-3 text-sm font-medium text-indigo-600">
                {rec.periodStart} — {rec.periodEnd}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={rec.status} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                ${(rec.totalActualCosts / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(rec.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab({ propertyId }: { propertyId: string }) {
  const { data: activities, isLoading } = usePropertyActivity(propertyId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <SkeletonListRow />
        <SkeletonListRow />
        <SkeletonListRow />
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No activity yet"
        description="Recent actions will appear here as you upload documents, add tenants, and run reconciliations."
      />
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-900">{entry.description}</p>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(entry.created_at).toLocaleString()} · {entry.action.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

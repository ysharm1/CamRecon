import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  Activity as ActivityIcon,
  Upload,
  Plus,
  Calculator,
  TrendingUp,
  Ruler,
  Clock,
  LucideIcon,
} from 'lucide-react';
import { useProperty, usePropertyActivity } from '@/hooks/useProperties';
import { useReconciliations } from '@/hooks/useReconciliations';
import { SkeletonMetricCard, SkeletonListRow } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useGlobalUI } from '@/hooks/useCommandPalette';

type Tab = 'overview' | 'documents' | 'tenants' | 'reconciliations' | 'activity';

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading, error, refetch } = useProperty(id || '');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { open } = useGlobalUI();
  const navigate = useNavigate();
  const { data: activities } = usePropertyActivity(id || '');
  const { data: reconciliations } = useReconciliations(id || '');

  const metrics = useMemo(() => {
    if (!property) return null;
    const activeTenants = (property.tenants || []).filter((t) => t.status === 'active');
    const occupiedArea = activeTenants.reduce((sum, t) => sum + t.squareFootage, 0);
    const occupancyRate = property.totalSquareFootage > 0 ? occupiedArea / property.totalSquareFootage : 0;
    return {
      totalTenants: property.tenants?.length ?? 0,
      activeTenants: activeTenants.length,
      documents: property.documents?.length ?? 0,
      occupancyRate,
      occupiedArea,
    };
  }, [property]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/properties"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to properties
        </Link>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-50 p-2">
              <Building2 className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">{property.name}</h2>
              <p className="text-sm capitalize text-gray-500">
                {property.propertyType} · {property.totalSquareFootage.toLocaleString()} sqft
              </p>
            </div>
          </div>
          <QuickActionBar
            onUpload={() => open('upload', { upload: { propertyId: property.id } })}
            onAddTenant={() => open('quickAddTenant', { quickAddTenant: { propertyId: property.id } })}
            onNewRecon={() =>
              open('quickAddReconciliation', {
                quickAddReconciliation: { propertyId: property.id },
              })
            }
          />
        </div>
      </div>

      {/* Key metrics */}
      {metrics && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PropertyMetric
            label="Occupancy rate"
            icon={TrendingUp}
            value={`${(metrics.occupancyRate * 100).toFixed(1)}%`}
            sub={
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full ${
                    metrics.occupancyRate >= 0.9
                      ? 'bg-green-500'
                      : metrics.occupancyRate >= 0.7
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(metrics.occupancyRate * 100, 100)}%` }}
                />
              </div>
            }
          />
          <PropertyMetric
            label="Active tenants"
            icon={Users}
            value={metrics.activeTenants.toString()}
            sub={`${metrics.totalTenants - metrics.activeTenants} inactive`}
          />
          <PropertyMetric
            label="Occupied area"
            icon={Ruler}
            value={`${metrics.occupiedArea.toLocaleString()} sqft`}
            sub={`of ${property.totalSquareFootage.toLocaleString()} sqft`}
          />
          <PropertyMetric
            label="Documents"
            icon={FileText}
            value={metrics.documents.toString()}
            sub={metrics.documents === 1 ? 'file on record' : 'files on record'}
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

// --- Quick action bar ---

function QuickActionBar({
  onUpload,
  onAddTenant,
  onNewRecon,
}: {
  onUpload: () => void;
  onAddTenant: () => void;
  onNewRecon: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <QuickBtn icon={Upload} label="Upload" onClick={onUpload} />
      <QuickBtn icon={Plus} label="Add tenant" onClick={onAddTenant} />
      <QuickBtn icon={Calculator} label="New reconciliation" onClick={onNewRecon} primary />
    </div>
  );
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

// --- Metric ---

function PropertyMetric({
  label,
  icon: Icon,
  value,
  sub,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold text-gray-900">{value}</p>
      {typeof sub === 'string' ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : sub}
    </div>
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

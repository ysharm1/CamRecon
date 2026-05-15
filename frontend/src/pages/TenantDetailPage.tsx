import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  FileText,
  Activity as ActivityIcon,
  AlertCircle,
  DollarSign,
  Sparkles,
  Loader2,
  CalendarClock,
  CalendarDays,
  Ruler,
  TrendingUp,
  Send,
  Mail,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant, useTenants, useTenantActivity } from '@/hooks/useTenants';
import { useLeaseSummary } from '@/hooks/useAI';
import { SkeletonCard } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { DetailHeader, StatusTone } from '@/components/DetailHeader';
import { KPICard } from '@/components/KPICard';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import type { LeaseInfo, TenantDocument } from '@/hooks/useTenants';
import type { ActivityEntry } from '@/hooks/useProperties';

type Tab = 'lease' | 'documents' | 'statements' | 'activity';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tenant, isLoading, error } = useTenant(id || '');
  const [activeTab, setActiveTab] = useState<Tab>('lease');
  const { open } = useGlobalUI();
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch siblings (other tenants in same property) for record switcher.
  const { data: siblingTenants } = useTenants(tenant?.propertyId);

  // Determine if user came from property page — if so, breadcrumb includes
  // property hop. Falls back to flat /tenants breadcrumb otherwise.
  const cameFromProperty = location.state &&
    typeof location.state === 'object' &&
    'fromProperty' in location.state &&
    location.state.fromProperty === true;

  const breadcrumb = useMemo(() => {
    if (!tenant) return [];
    if (cameFromProperty && tenant.propertyId && tenant.propertyName) {
      return [
        { label: 'Properties', href: '/properties' },
        { label: tenant.propertyName, href: `/properties/${tenant.propertyId}` },
        { label: 'Tenants' },
        { label: tenant.name },
      ];
    }
    return [
      { label: 'Tenants', href: '/tenants' },
      { label: tenant.name },
    ];
  }, [tenant, cameFromProperty]);

  const siblings = useMemo(() => {
    if (!siblingTenants || !tenant) return [];
    return siblingTenants
      .filter((t) => t.propertyId === tenant.propertyId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ id: t.id, label: t.name }));
  }, [siblingTenants, tenant]);

  const kpis = useMemo(() => {
    if (!tenant) return null;
    const lease = tenant.lease;
    if (!lease) {
      return {
        monthlyRent: '—',
        expiration: '—',
        daysToExpiry: '—',
        daysTone: 'neutral' as const,
        sqft: tenant.squareFootage.toLocaleString(),
        variance: '—',
      };
    }
    const expDate = new Date(lease.expirationDate);
    const days = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const daysTone: 'positive' | 'negative' | 'neutral' =
      days < 0 ? 'negative' : days <= 90 ? 'negative' : days <= 180 ? 'neutral' : 'positive';
    return {
      monthlyRent: `$${(lease.baseRentCents / 100).toLocaleString()}`,
      expiration: expDate.toLocaleDateString(),
      daysToExpiry: days < 0 ? 'Expired' : `${days}`,
      daysTone,
      sqft: tenant.squareFootage.toLocaleString(),
      variance: '—', // Variance YTD requires reconciliation data; placeholder.
    };
  }, [tenant]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-12 text-center">
        <AlertCircle className="h-6 w-6 text-red-500" />
        <p className="mt-2 text-sm font-medium text-red-700">Failed to load tenant details.</p>
        <div className="mt-3 flex gap-2">
          <Link
            to="/tenants"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Back to tenants
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <EmptyState
        icon={Users}
        title="Tenant not found"
        description="This tenant may have been removed or you don't have access."
        action={
          <Link
            to="/tenants"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to tenants
          </Link>
        }
      />
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'lease', label: 'Lease Info', icon: <FileText className="h-4 w-4" /> },
    { key: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
    { key: 'statements', label: 'Statements', icon: <DollarSign className="h-4 w-4" /> },
    { key: 'activity', label: 'Activity', icon: <ActivityIcon className="h-4 w-4" /> },
  ];

  const statusTone: StatusTone =
    tenant.status === 'active' ? 'success' : tenant.status === 'pending' ? 'warning' : 'neutral';

  return (
    <div className="space-y-6">
      <DetailHeader
        breadcrumb={breadcrumb}
        icon={Users}
        iconColor="emerald"
        title={tenant.name}
        subtitle={
          <>
            Suite {tenant.suiteNumber} · {tenant.squareFootage.toLocaleString()} sqft
            {tenant.propertyName && (
              <>
                {' · '}
                <Link
                  to={`/properties/${tenant.propertyId}`}
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  {tenant.propertyName}
                </Link>
              </>
            )}
          </>
        }
        status={{ label: tenant.status, tone: statusTone }}
        recordSwitcher={
          siblings.length > 1
            ? {
                items: siblings,
                currentId: tenant.id,
                onSelect: (newId) => navigate(`/tenants/${newId}`),
              }
            : undefined
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => open('upload', { upload: { propertyId: tenant.propertyId, tenantId: tenant.id } })}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-3.5 w-3.5" />
              + Document
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lease')}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-3.5 w-3.5" />
              View lease
            </button>
            <button
              type="button"
              onClick={() => toast.success(`Statement will be emailed to ${tenant.contactEmail}`)}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Send className="h-3.5 w-3.5" />
              Send statement
            </button>
          </>
        }
      />

      {/* KPI snapshot row */}
      {kpis && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KPICard label="Monthly rent" icon={DollarSign} value={kpis.monthlyRent} />
          <KPICard label="Lease expires" icon={CalendarDays} value={kpis.expiration} />
          <KPICard
            label="Days to expiry"
            icon={CalendarClock}
            value={kpis.daysToExpiry}
            delta={
              kpis.daysToExpiry !== '—'
                ? {
                    value: kpis.daysTone === 'negative' ? 'soon' : kpis.daysTone === 'positive' ? 'on track' : 'watch',
                    tone: kpis.daysTone,
                  }
                : undefined
            }
          />
          <KPICard label="Total sqft" icon={Ruler} value={kpis.sqft} />
          <KPICard
            label="Variance YTD"
            icon={TrendingUp}
            value={kpis.variance}
            hint="From reconciliations"
          />
        </div>
      )}

      {/* Contact card */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-gray-400" />
          <a
            href={`mailto:${tenant.contactEmail}`}
            className="text-indigo-600 hover:text-indigo-500"
          >
            {tenant.contactEmail}
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'lease' && <LeaseTab lease={tenant.lease} tenantId={tenant.id} />}
      {activeTab === 'documents' && <DocumentsTab documents={tenant.documents || []} />}
      {activeTab === 'statements' && <StatementsTab tenantId={tenant.id} />}
      {activeTab === 'activity' && <ActivityTab tenantId={tenant.id} />}
    </div>
  );
}

// ─── LeaseTab with AI Summary ────────────────────────────────────────────────

function LeaseTab({ lease, tenantId }: { lease: LeaseInfo | null; tenantId: string }) {
  const summaryMutation = useLeaseSummary();
  const [summaryText, setSummaryText] = useState<string | null>(null);

  function handleGenerateSummary() {
    summaryMutation.mutate(tenantId, {
      onSuccess: (result) => {
        setSummaryText(result.summary);
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* AI Lease Summary Card */}
      {lease && (
        <div className="rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              AI Summary
            </span>
          </div>

          {summaryText || summaryMutation.data?.summary ? (
            <p className="text-sm text-gray-800 leading-relaxed">
              {summaryText || summaryMutation.data?.summary}
            </p>
          ) : summaryMutation.isPending ? (
            <div className="flex items-center gap-2 text-sm text-indigo-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating summary...
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Generate a plain-English summary of this lease.
              </p>
              <button
                onClick={handleGenerateSummary}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Sparkles className="h-3 w-3" />
                Generate Summary
              </button>
            </div>
          )}

          {summaryMutation.isError && (
            <p className="mt-2 text-xs text-red-600">
              Failed to generate summary. Please try again.
            </p>
          )}
        </div>
      )}

      {/* Lease Terms */}
      {lease ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Lease Terms</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Commencement</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(lease.commencementDate).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Expiration</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(lease.expirationDate).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Base Rent</dt>
              <dd className="mt-1 text-sm text-gray-900">
                ${(lease.baseRentCents / 100).toLocaleString()}/mo
              </dd>
            </div>
            {lease.camCapCents && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">CAM Cap</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  ${(lease.camCapCents / 100).toLocaleString()}/mo
                </dd>
              </div>
            )}
            {lease.rentEscalation && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">Escalation</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {lease.rentEscalation.rate}% {lease.rentEscalation.type}
                </dd>
              </div>
            )}
            {lease.securityDepositCents && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">Security Deposit</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  ${(lease.securityDepositCents / 100).toLocaleString()}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Confidence</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    lease.confidenceScore >= 0.85
                      ? 'bg-green-100 text-green-700'
                      : lease.confidenceScore >= 0.6
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {(lease.confidenceScore * 100).toFixed(0)}%
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Review Status</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    lease.reviewStatus === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : lease.reviewStatus === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {lease.reviewStatus}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No lease data"
          description="No lease abstraction has been processed for this tenant yet."
          variant="plain"
        />
      )}
    </div>
  );
}

// ─── DocumentsTab ────────────────────────────────────────────────────────────

function DocumentsTab({ documents }: { documents: TenantDocument[] }) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents"
        description="No documents have been associated with this tenant."
        variant="plain"
      />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Version</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium">
                <Link to={`/documents/${doc.id}`} className="text-indigo-600 hover:text-indigo-500">
                  {doc.title}
                </Link>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {doc.documentType.replace(/_/g, ' ')}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">v{doc.currentVersion}</td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(doc.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── StatementsTab ───────────────────────────────────────────────────────────

function StatementsTab({ tenantId: _tenantId }: { tenantId: string }) {
  return (
    <EmptyState
      icon={DollarSign}
      title="No statements"
      description="Statements will appear here after CAM reconciliations are completed."
      variant="plain"
    />
  );
}

// ─── ActivityTab ─────────────────────────────────────────────────────────────

function ActivityTab({ tenantId }: { tenantId: string }) {
  const { data: activities, isLoading } = useTenantActivity(tenantId);

  if (isLoading) {
    return <SkeletonCard lines={4} />;
  }

  if (!activities || activities.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity"
        description="Activity for this tenant will appear here."
        variant="plain"
      />
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((entry: ActivityEntry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 px-4 py-3"
        >
          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{entry.description}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {new Date(entry.created_at).toLocaleString()} · {entry.action.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

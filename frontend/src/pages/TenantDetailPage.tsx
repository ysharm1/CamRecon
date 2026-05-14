import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, FileText, Activity as ActivityIcon, CheckCircle, AlertCircle, Clock, DollarSign, Sparkles, Loader2 } from 'lucide-react';
import { useTenant, useTenantActivity } from '@/hooks/useTenants';
import { useLeaseSummary } from '@/hooks/useAI';
import { SkeletonCard } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { useState } from 'react';
import type { LeaseInfo, TenantDocument } from '@/hooks/useTenants';
import type { ActivityEntry } from '@/hooks/useProperties';

type Tab = 'lease' | 'documents' | 'statements' | 'activity';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tenant, isLoading, error } = useTenant(id || '');
  const [activeTab, setActiveTab] = useState<Tab>('lease');

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/tenants"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tenants
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-50 p-2">
            <Users className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{tenant.name}</h2>
            <p className="text-sm text-gray-500">
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
            </p>
          </div>
          <StatusBadge status={tenant.status} />
        </div>
      </div>

      {/* Tenant Info Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">Contact Email</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{tenant.contactEmail}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">Suite Number</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{tenant.suiteNumber}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">Leased Area</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{tenant.squareFootage.toLocaleString()} sqft</p>
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

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status}
    </span>
  );
}

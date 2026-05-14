import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, FileText, Activity as ActivityIcon, CheckCircle, AlertCircle, Clock, DollarSign } from 'lucide-react';
import { useTenant, useTenantActivity } from '@/hooks/useTenants';
import { SkeletonCard } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { useState } from 'react';

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
      {activeTab === 'lease' && <LeaseTab lease={tenant.lease} />}
      {activeTab === 'documents' && <DocumentsTab documents={tenant.documents || []} />}
      {activeTab === 'statements' && <StatementsTab tenantId={tenant.id} />}
      {activeTab === 'activity' && <ActivityTab tenantId={tenant.id} />}
    </div>
  );
}

function LeaseTab({ lease }: { lease: { id: string; commencementDate: string; expirationDate: string; baseRentCents: number; rentEscalation: { type: string; rate: number } | null; camCapCents: number | null; securityDepositCents: number | null; confidenceScore: number; reviewStatus: string } | null }) {
  if (!lease) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">No lease abstraction data available for this tenant.</p>
      </div>
    );
  }

  const formatCents = (cents: number) => `$${(cents / 100).toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Abstraction Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">Abstraction Status</h4>
          <ReviewStatusBadge status={lease.reviewStatus} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-indigo-600"
              style={{ width: `${lease.confidenceScore * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{(lease.confidenceScore * 100).toFixed(0)}% confidence</span>
        </div>
      </div>

      {/* Lease Terms */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Lease Terms</h4>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Commencement Date</dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(lease.commencementDate).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Expiration Date</dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(lease.expirationDate).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Base Rent (Monthly)</dt>
            <dd className="text-sm font-medium text-gray-900">{formatCents(lease.baseRentCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Rent Escalation</dt>
            <dd className="text-sm font-medium text-gray-900">
              {lease.rentEscalation
                ? `${lease.rentEscalation.rate}% ${lease.rentEscalation.type.replace('_', ' ')}`
                : '—'}
            </dd>
          </div>
          {lease.camCapCents && (
            <div>
              <dt className="text-xs text-gray-500">CAM Cap</dt>
              <dd className="text-sm font-medium text-gray-900">{formatCents(lease.camCapCents)}/mo</dd>
            </div>
          )}
          {lease.securityDepositCents && (
            <div>
              <dt className="text-xs text-gray-500">Security Deposit</dt>
              <dd className="text-sm font-medium text-gray-900">{formatCents(lease.securityDepositCents)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    approved: { icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-700', label: 'Approved' },
    pending: { icon: <Clock className="h-3.5 w-3.5" />, color: 'bg-amber-100 text-amber-700', label: 'Pending Review' },
    needs_correction: { icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'bg-red-100 text-red-700', label: 'Needs Correction' },
  };
  const { icon, color, label } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {icon}
      {label}
    </span>
  );
}

function DocumentsTab({ documents }: { documents: { id: string; title: string; documentType: string; currentVersion: number; createdAt: string }[] }) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents"
        description="No documents associated with this tenant yet."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  to={`/documents/${doc.id}`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  {doc.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 capitalize">{doc.documentType}</td>
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

function StatementsTab({ tenantId: _tenantId }: { tenantId: string }) {
  // Statements are derived from reconciliation allocations for this tenant.
  // In a full implementation this would call a dedicated endpoint.
  return (
    <EmptyState
      icon={DollarSign}
      title="No statements yet"
      description="CAM allocation statements will appear here after reconciliations are completed for this tenant's property."
      action={
        <Link
          to="/reconciliations"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          View reconciliations
        </Link>
      }
    />
  );
}

function ActivityTab({ tenantId }: { tenantId: string }) {
  const { data: activities, isLoading } = useTenantActivity(tenantId);

  if (isLoading) {
    return <SkeletonCard lines={5} />;
  }

  if (!activities || activities.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity yet"
        description="Actions related to this tenant will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">{entry.description}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(entry.created_at).toLocaleString()} · {entry.action}
            </p>
          </div>
        </div>
      ))}
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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

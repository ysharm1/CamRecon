import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, DollarSign, Download, Building2, User, AlertCircle } from 'lucide-react';

interface TenantInfo {
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  suiteNumber: string;
}

interface Document {
  id: string;
  title: string;
  documentType: string;
  currentVersion: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface Statement {
  id: string;
  periodStart: string;
  periodEnd: string;
  propertyName: string;
  sharePercentage: number;
  estimatedAmountCents: number;
  actualAmountCents: number;
  varianceCents: number;
  status: string;
  completedAt: string | null;
}

interface Balance {
  outstandingBalanceCents: number;
  totalEstimatedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TenantPortalPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No access token provided. Please use the link shared with you.');
      setLoading(false);
      return;
    }

    async function loadPortalData() {
      try {
        // Verify token first
        const verifyRes = await fetch(`/api/portal/verify/${token}`);
        if (!verifyRes.ok) {
          const errData = await verifyRes.json().catch(() => ({}));
          throw new Error(errData?.error?.message || 'Invalid or expired access token');
        }
        const verifyData = await verifyRes.json();
        setTenantInfo(verifyData.data);

        // Fetch portal data in parallel using the token for auth
        const headers = { Authorization: `Bearer ${token}` };

        const [docsRes, statementsRes, balanceRes] = await Promise.all([
          fetch('/api/portal/documents', { headers }),
          fetch('/api/portal/statements', { headers }),
          fetch('/api/portal/balance', { headers }),
        ]);

        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocuments(docsData.data || []);
        }

        if (statementsRes.ok) {
          const statementsData = await statementsRes.json();
          setStatements(statementsData.data || []);
        }

        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          setBalance(balanceData.data || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load portal data');
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-7 w-7 text-indigo-600" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Tenant Portal</h1>
                {tenantInfo && (
                  <p className="text-sm text-gray-500">
                    {tenantInfo.propertyName} — Suite {tenantInfo.suiteNumber}
                  </p>
                )}
              </div>
            </div>
            {tenantInfo && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{tenantInfo.tenantName}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Balance Card */}
        {balance && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">Outstanding Balance</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">Total Estimated</p>
                <p className="text-xl font-semibold text-gray-900">
                  {formatCents(balance.totalEstimatedCents)}
                </p>
              </div>
              <div className="text-center p-4 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">Total Actual</p>
                <p className="text-xl font-semibold text-gray-900">
                  {formatCents(balance.totalActualCents)}
                </p>
              </div>
              <div className="text-center p-4 rounded-md bg-indigo-50">
                <p className="text-sm text-indigo-600">Outstanding Balance</p>
                <p className={`text-xl font-semibold ${balance.outstandingBalanceCents > 0 ? 'text-red-600' : balance.outstandingBalanceCents < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {formatCents(balance.outstandingBalanceCents)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Documents Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
          </div>
          {documents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{doc.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{doc.documentType}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatFileSize(doc.sizeBytes)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(doc.createdAt)}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`/api/documents/${doc.id}/download?token=${token}`}
                          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-500"
                          download
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No documents shared with you yet.</p>
          )}
        </div>

        {/* Statements Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">CAM Statements</h2>
          </div>
          {statements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Share %</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statements.map((stmt) => (
                    <tr key={stmt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(stmt.periodStart)} — {formatDate(stmt.periodEnd)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {stmt.sharePercentage.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatCents(stmt.estimatedAmountCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatCents(stmt.actualAmountCents)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${stmt.varianceCents > 0 ? 'text-red-600' : stmt.varianceCents < 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {formatCents(stmt.varianceCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          stmt.status === 'completed' || stmt.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : stmt.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {stmt.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No CAM statements available yet.</p>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-xs text-gray-400 text-center">
            Property Document Platform — Tenant Portal
          </p>
        </div>
      </footer>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Download,
  Upload,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Shield,
  Brain,
  Sparkles,
  Loader2,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useDocument,
  useDocuments,
  useUploadVersion,
  useDocumentAuditTrail,
} from '@/hooks/useDocuments';
import { useAbstractionSummary, useDocumentInsights } from '@/hooks/useAI';
import { SkeletonCard } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { DetailHeader, StatusTone } from '@/components/DetailHeader';

const DOC_TYPE_LABEL: Record<string, string> = {
  lease: 'Lease',
  amendment: 'Amendment',
  cam_report: 'CAM Report',
  insurance: 'Insurance',
  correspondence: 'Correspondence',
  other: 'Other',
};

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: document, isLoading, error } = useDocument(id || '');
  const { data: auditTrail, isLoading: auditLoading } = useDocumentAuditTrail(id || '');
  const { data: propertyDocuments } = useDocuments(document?.propertyId);
  const [showVersionUpload, setShowVersionUpload] = useState(false);

  const siblings = useMemo(() => {
    if (!propertyDocuments || !document) return [];
    return propertyDocuments
      .filter((d) => d.propertyId === document.propertyId)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((d) => ({ id: d.id, label: d.title }));
  }, [propertyDocuments, document]);

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Couldn't load document"
        description="Failed to fetch document details."
        action={
          <Link
            to="/documents"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to documents
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (!document) {
    return (
      <EmptyState
        icon={FileText}
        title="Document not found"
        description="This document may have been removed or you don't have access."
        action={
          <Link
            to="/documents"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to documents
          </Link>
        }
      />
    );
  }

  const docTypeLabel = DOC_TYPE_LABEL[document.documentType] ?? document.documentType.replace(/_/g, ' ');

  const abstractionTone: StatusTone | undefined = document.abstraction
    ? document.abstraction.status === 'approved'
      ? 'success'
      : document.abstraction.status === 'pending'
        ? 'warning'
        : document.abstraction.status === 'rejected'
          ? 'error'
          : 'neutral'
    : undefined;

  function handleCopyLink() {
    const url = `${window.location.origin}/documents/${document!.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard');
    });
  }

  return (
    <div className="space-y-6">
      <DetailHeader
        breadcrumb={[
          { label: 'Documents', href: '/documents' },
          { label: document.title },
        ]}
        icon={FileText}
        iconColor="violet"
        title={document.title}
        subtitle={
          <>
            <span className="capitalize">{docTypeLabel}</span>
            {' · '}v{document.currentVersion}
            {' · '}
            {(document.sizeBytes / 1024).toFixed(1)} KB
            {document.propertyName && (
              <>
                {' · '}
                <Link
                  to={`/properties/${document.propertyId}`}
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  {document.propertyName}
                </Link>
              </>
            )}
            {document.tenantName && (
              <>
                {' · '}
                <Link
                  to={`/tenants/${document.tenantId}`}
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  {document.tenantName}
                </Link>
              </>
            )}
          </>
        }
        status={
          abstractionTone && document.abstraction
            ? { label: document.abstraction.status, tone: abstractionTone }
            : undefined
        }
        recordSwitcher={
          siblings.length > 1
            ? {
                items: siblings,
                currentId: document.id,
                onSelect: (newId) => navigate(`/documents/${newId}`),
              }
            : undefined
        }
        actions={
          <>
            <a
              href={`/api/documents/${document.id}/versions/${document.currentVersion}/download`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </button>
            <button
              type="button"
              onClick={() => setShowVersionUpload(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Upload className="h-3.5 w-3.5" />
              New version
            </button>
          </>
        }
      />

      {/* AI Insights — shown for lease documents with abstractions */}
      {document.abstraction && (
        <AIInsightsCard documentId={document.id} abstraction={document.abstraction} />
      )}

      {/* Metadata grid (compact) */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Metadata</h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">MIME type</dt>
            <dd className="mt-1 text-sm text-gray-900">{document.mimeType}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Size</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {(document.sizeBytes / 1024).toFixed(1)} KB
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(document.createdAt).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Last updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(document.updatedAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* AI Abstraction status and extracted terms */}
      {document.abstraction && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-gray-900">AI Abstraction</h3>
            <span
              className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                document.abstraction.status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : document.abstraction.status === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : document.abstraction.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
              }`}
            >
              {document.abstraction.status}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            {document.abstraction.status === 'approved' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600" />
            )}
            <p className="text-sm text-gray-600">
              Confidence: {(document.abstraction.confidenceScore * 100).toFixed(0)}%
            </p>
          </div>

          {document.abstraction.extractedTerms &&
            document.abstraction.extractedTerms.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                  Extracted Terms
                </h4>
                <div className="rounded-md border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Field
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Value
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Confidence
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {document.abstraction.extractedTerms.map((term, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                            {term.field.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {term.value !== null ? String(term.value) : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <ConfidenceBadge score={term.confidence} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {document.abstraction.status === 'pending' && (
            <Link
              to="/abstractions"
              className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-500"
            >
              Review abstraction →
            </Link>
          )}
        </div>
      )}

      {/* Versions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Version history</h3>
          </div>
          <button
            onClick={() => setShowVersionUpload(true)}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Upload className="h-3 w-3" />
            Upload new version
          </button>
        </div>

        {showVersionUpload && (
          <VersionUploadForm
            documentId={document.id}
            onClose={() => setShowVersionUpload(false)}
          />
        )}

        {document.versions && document.versions.length > 0 ? (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <ul className="space-y-4">
              {document.versions.map((version) => (
                <li key={version.id} className="relative pl-10">
                  <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-indigo-600 bg-white" />
                  <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Version {version.versionNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {version.fileName} · {(version.sizeBytes / 1024).toFixed(1)} KB ·{' '}
                        {new Date(version.createdAt).toLocaleString()}
                      </p>
                      {version.changeDescription && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">
                          {version.changeDescription}
                        </p>
                      )}
                    </div>
                    <a
                      href={`/api/documents/${document.id}/versions/${version.versionNumber}/download`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-6">
            <FileText className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No version history available.</p>
          </div>
        )}
      </div>

      {/* Audit Trail */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Audit trail</h3>
        </div>

        {auditLoading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        ) : auditTrail && auditTrail.length > 0 ? (
          <div className="space-y-2">
            {auditTrail.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <AuditActionIcon action={entry.action} />
                  <div>
                    <p className="text-sm text-gray-900 capitalize">
                      {entry.action.replace(/_/g, ' ')}
                    </p>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <p className="text-xs text-gray-500">
                        {formatAuditMetadata(entry.metadata)}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No audit entries yet.</p>
        )}
      </div>
    </div>
  );
}

function AIInsightsCard({
  documentId,
  abstraction,
}: {
  documentId: string;
  abstraction: {
    status: string;
    confidenceScore: number;
    extractedTerms?: Array<{ field: string; value: string | number | null; confidence: number }>;
  };
}) {
  const summaryMutation = useAbstractionSummary();
  const insightsMutation = useDocumentInsights();
  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    summaryMutation.mutate(documentId);
    insightsMutation.mutate(documentId, {
      onSuccess: () => setGenerated(true),
    });
  }

  const isLoading = summaryMutation.isPending || insightsMutation.isPending;
  const summary = summaryMutation.data?.summary;
  const risks = insightsMutation.data?.risks ?? [];

  const expirationTerm = abstraction.extractedTerms?.find(
    (t) => t.field === 'expiration_date'
  );
  let daysUntilExpiry: number | null = null;
  if (expirationTerm?.value != null) {
    const expDate = new Date(String(expirationTerm.value));
    if (!isNaN(expDate.getTime())) {
      daysUntilExpiry = Math.ceil(
        (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          AI Insights
        </span>
      </div>

      {summary ? (
        <p className="text-sm text-gray-800 leading-relaxed mb-3">{summary}</p>
      ) : !generated && !isLoading ? (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            Generate AI-powered insights for this document.
          </p>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </button>
        </div>
      ) : null}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-indigo-600 mb-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing document...
        </div>
      )}

      {daysUntilExpiry !== null && (
        <div className="mb-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              daysUntilExpiry <= 30
                ? 'bg-red-100 text-red-700'
                : daysUntilExpiry <= 90
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
            }`}
          >
            {daysUntilExpiry <= 0
              ? 'Expired'
              : `Expires in ${daysUntilExpiry} days`}
          </span>
        </div>
      )}

      {risks.length > 0 && (
        <div className="space-y-1.5">
          {risks.map((risk, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-gray-700">{risk}</p>
            </div>
          ))}
        </div>
      )}

      {generated && (
        <div className="mt-3 pt-3 border-t border-indigo-100">
          <Link
            to="/abstractions"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            View full abstraction →
          </Link>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const percentage = (score * 100).toFixed(0);
  let colorClass = 'bg-red-100 text-red-700';
  if (score >= 0.85) {
    colorClass = 'bg-green-100 text-green-700';
  } else if (score >= 0.6) {
    colorClass = 'bg-amber-100 text-amber-700';
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {percentage}%
    </span>
  );
}

function AuditActionIcon({ action }: { action: string }) {
  const iconClass = 'h-4 w-4';
  switch (action) {
    case 'created':
    case 'uploaded':
      return <Upload className={`${iconClass} text-green-500`} />;
    case 'downloaded':
      return <Download className={`${iconClass} text-blue-500`} />;
    case 'updated':
    case 'version_added':
      return <Clock className={`${iconClass} text-amber-500`} />;
    default:
      return <FileText className={`${iconClass} text-gray-400`} />;
  }
}

function formatAuditMetadata(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  if (metadata.version) parts.push(`v${metadata.version}`);
  if (metadata.description) parts.push(String(metadata.description));
  if (metadata.fileName) parts.push(String(metadata.fileName));
  return parts.join(' · ') || '';
}

function VersionUploadForm({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [changeDescription, setChangeDescription] = useState('');
  const uploadMutation = useUploadVersion(documentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (changeDescription) {
      formData.append('changeDescription', changeDescription);
    }

    try {
      await uploadMutation.mutateAsync(formData);
      toast.success('New version uploaded successfully!');
      onClose();
    } catch {
      toast.error('Failed to upload version.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 p-4 rounded-md border border-indigo-200 bg-indigo-50"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm text-gray-700"
          />
        </div>
        <div>
          <label htmlFor="change-description" className="block text-xs font-medium text-gray-600 mb-1">
            Change description (optional)
          </label>
          <input
            id="change-description"
            type="text"
            value={changeDescription}
            onChange={(e) => setChangeDescription(e.target.value)}
            placeholder="Describe what changed..."
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={uploadMutation.isPending || !file}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

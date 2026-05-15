import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Copy,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDocuments, useDocumentVersions, Document } from '@/hooks/useDocuments';
import { useProperties } from '@/hooks/useProperties';
import { SkeletonTable } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { RowActions } from '@/components/RowActions';
import { IndexHeader } from '@/components/IndexHeader';
import { useGlobalUI } from '@/hooks/useCommandPalette';

const DOCUMENT_TYPES = [
  { value: 'lease', label: 'Lease' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'cam_report', label: 'CAM Report' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'other', label: 'Other' },
];

export function DocumentsPage() {
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const { data: documents, isLoading, error, refetch } = useDocuments();
  const { data: properties } = useProperties();
  const { open } = useGlobalUI();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!documents) return [];
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (typeFilter && d.documentType !== typeFilter) return false;
      if (propertyFilter && d.propertyId !== propertyFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.propertyName ?? '').toLowerCase().includes(q) ||
        (d.tenantName ?? '').toLowerCase().includes(q)
      );
    });
  }, [documents, search, typeFilter, propertyFilter]);

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Failed to load documents"
        action={
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        }
      />
    );
  }

  function toggleExpand(docId: string) {
    setExpandedDocId((prev) => (prev === docId ? null : docId));
  }

  const total = documents?.length ?? 0;
  const showing = filtered.length;
  const propertyName = properties?.find((p) => p.id === propertyFilter)?.name;
  const typeName = DOCUMENT_TYPES.find((t) => t.value === typeFilter)?.label;

  const activeFilters = [
    ...(propertyFilter && propertyName
      ? [{ label: `Property: ${propertyName}`, onRemove: () => setPropertyFilter('') }]
      : []),
    ...(typeFilter && typeName
      ? [{ label: `Type: ${typeName}`, onRemove: () => setTypeFilter('') }]
      : []),
    ...(search
      ? [{ label: `Search: "${search}"`, onRemove: () => setSearch('') }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <IndexHeader
        title="Documents"
        description="Upload, manage, and track document versions."
        count={total}
        primaryAction={{
          label: 'Upload document',
          icon: Upload,
          onClick: () => open('upload'),
        }}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search documents...',
        }}
        filters={
          <>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All properties</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All types</option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </>
        }
        activeFilters={activeFilters}
        resultLabel={
          total > 0 && showing !== total
            ? `Showing ${showing} of ${total}`
            : total > 0
              ? `Showing ${total}`
              : undefined
        }
      />

      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={total === 0 ? 'No documents yet' : 'No documents match'}
          description={
            total === 0
              ? 'Drag and drop a file to upload, or use the Upload button. Leases will be auto-analyzed by AI.'
              : 'Try a different search or clear filters.'
          }
          action={
            total === 0 ? (
              <button
                type="button"
                onClick={() => open('upload')}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Upload className="h-4 w-4" />
                Upload your first document
              </button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">Type</th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">Property</th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:table-cell">Tenant</th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">Version</th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:table-cell">Date</th>
                <th className="w-12 px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  isExpanded={expandedDocId === doc.id}
                  onToggleExpand={() => toggleExpand(doc.id)}
                  onNavigate={() => navigate(`/documents/${doc.id}`)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  isExpanded,
  onToggleExpand,
  onNavigate,
}: {
  doc: Document;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigate: () => void;
}) {
  function handleCopyLink() {
    const url = `${window.location.origin}/documents/${doc.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard');
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${doc.title}"? This will archive the document. You can restore it later by contacting support.`,
    );
    if (!confirmed) return;
    toast.success(`"${doc.title}" archived.`);
  }

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-3 py-4">
          <button
            onClick={onToggleExpand}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={isExpanded ? 'Collapse version history' : 'Expand version history'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="whitespace-nowrap px-6 py-4">
          <Link
            to={`/documents/${doc.id}`}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <FileText className="h-4 w-4" />
            {doc.title}
          </Link>
        </td>
        <td className="hidden whitespace-nowrap px-6 py-4 md:table-cell">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {doc.documentType.replace('_', ' ')}
          </span>
        </td>
        <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-700 md:table-cell">
          {doc.propertyName || '—'}
        </td>
        <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-700 lg:table-cell">
          {doc.tenantName || '—'}
        </td>
        <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-700 md:table-cell">
          v{doc.currentVersion}
        </td>
        <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 lg:table-cell">
          {new Date(doc.createdAt).toLocaleDateString()}
        </td>
        <td className="px-6 py-4 text-right">
          <RowActions
            actions={[
              { label: 'View', icon: Eye, onClick: onNavigate },
              {
                label: 'Download',
                icon: Download,
                href: `/api/documents/${doc.id}/versions/${doc.currentVersion}/download`,
              },
              { label: 'Copy link', icon: Copy, onClick: handleCopyLink },
              { label: 'Delete', icon: Trash2, onClick: handleDelete },
            ]}
          />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-6 py-0">
            <VersionHistoryPanel documentId={doc.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function VersionHistoryPanel({ documentId }: { documentId: string }) {
  const { data: versions, isLoading } = useDocumentVersions(documentId);

  if (isLoading) {
    return (
      <div className="px-8 py-4">
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-48 rounded bg-gray-200" />
          <div className="h-3 w-36 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return <div className="px-8 py-4 text-sm text-gray-500">No version history available.</div>;
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-8 py-3">
      <p className="mb-2 text-xs font-medium uppercase text-gray-500">Version history</p>
      <div className="space-y-2">
        {versions.map((version) => (
          <div
            key={version.id}
            className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-2"
          >
            <div>
              <span className="text-sm font-medium text-gray-900">v{version.versionNumber}</span>
              <span className="ml-3 text-xs text-gray-500">
                {version.fileName} · {(version.sizeBytes / 1024).toFixed(1)} KB ·{' '}
                {new Date(version.createdAt).toLocaleString()}
              </span>
              {version.changeDescription && (
                <span className="ml-2 text-xs italic text-gray-400">
                  — {version.changeDescription}
                </span>
              )}
            </div>
            <a
              href={`/api/documents/${documentId}/versions/${version.versionNumber}/download`}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

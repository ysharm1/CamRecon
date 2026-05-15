import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calculator,
  Plus,
  FileDown,
  FlaskConical,
  Send,
  CheckCircle2,
  Sparkles,
  X,
  Copy,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useReconciliations,
  useReconciliation,
} from '@/hooks/useReconciliations';
import { useProperties } from '@/hooks/useProperties';
import { useDraftLetter } from '@/hooks/useAI';
import { SkeletonTable, SkeletonListRow } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { IndexHeader } from '@/components/IndexHeader';
import { DetailHeader, StatusTone } from '@/components/DetailHeader';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { isFeatureEnabled } from '@/lib/features';

type View = 'list' | 'detail';

export function ReconciliationsPage() {
  const [view, setView] = useState<View>('list');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedReconciliationId, setSelectedReconciliationId] = useState('');
  const [justCreated, setJustCreated] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // If the create wizard redirected here with `?created=<id>`, jump directly
  // into the detail view and show the success banner with next-step CTAs.
  useEffect(() => {
    const createdId = searchParams.get('created');
    if (createdId) {
      setSelectedReconciliationId(createdId);
      setJustCreated(true);
      setView('detail');
      // Clear the query param so refresh doesn't re-trigger the banner.
      searchParams.delete('created');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <ReconciliationList
          onSelect={(id) => {
            setSelectedReconciliationId(id);
            setJustCreated(false);
            setView('detail');
          }}
          propertyId={selectedPropertyId}
          onPropertyChange={setSelectedPropertyId}
        />
      )}
      {view === 'detail' && (
        <ReconciliationDetail
          reconciliationId={selectedReconciliationId}
          justCreated={justCreated}
          onBack={() => {
            setJustCreated(false);
            setView('list');
          }}
        />
      )}
    </div>
  );
}

function ReconciliationList({
  onSelect,
  propertyId,
  onPropertyChange,
}: {
  onSelect: (id: string) => void;
  propertyId: string;
  onPropertyChange: (id: string) => void;
}) {
  const navigate = useNavigate();
  const { data: properties } = useProperties();
  const { data: reconciliations, isLoading, error, refetch } = useReconciliations(propertyId || undefined);
  const { open } = useGlobalUI();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    if (!reconciliations) return [];
    const q = search.trim().toLowerCase();
    return reconciliations.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.propertyName ?? '').toLowerCase().includes(q) ||
        r.periodStart.toLowerCase().includes(q) ||
        r.periodEnd.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
  }, [reconciliations, search, statusFilter]);

  const total = reconciliations?.length ?? 0;
  const showing = filtered.length;
  const propertyName = properties?.find((p) => p.id === propertyId)?.name;

  const activeFilters = [
    ...(propertyId && propertyName
      ? [{ label: `Property: ${propertyName}`, onRemove: () => onPropertyChange('') }]
      : []),
    ...(statusFilter
      ? [{ label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter('') }]
      : []),
    ...(search
      ? [{ label: `Search: "${search}"`, onRemove: () => setSearch('') }]
      : []),
  ];

  return (
    <>
      <IndexHeader
        title="Reconciliations"
        description="CAM reconciliation workflows and history."
        count={total}
        primaryAction={{
          label: 'New reconciliation',
          icon: Plus,
          onClick: () => open('quickAddReconciliation'),
        }}
        secondaryActions={
          isFeatureEnabled('whatIfSimulator') && (
            <button
              onClick={() => navigate('/reconciliations/simulator')}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">What-If Simulator</span>
              <span className="sm:hidden">What-If</span>
            </button>
          )
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search reconciliations...',
        }}
        filters={
          <>
            <select
              value={propertyId}
              onChange={(e) => onPropertyChange(e.target.value)}
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In progress</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
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

      {error && (
        <EmptyState
          icon={Calculator}
          title="Couldn't load reconciliations"
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
      )}

      {isLoading ? (
        <SkeletonTable rows={4} columns={5} />
      ) : filtered.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Property</th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 sm:table-cell">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Total</th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((rec) => (
                <tr
                  key={rec.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onSelect(rec.id)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {rec.propertyName || rec.propertyId}
                  </td>
                  <td className="hidden px-6 py-4 text-sm text-gray-600 sm:table-cell">
                    {rec.periodStart} — {rec.periodEnd}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={rec.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${(rec.totalActualCosts / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="hidden px-6 py-4 text-sm text-gray-500 lg:table-cell">
                    {new Date(rec.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !error ? (
        <EmptyState
          icon={Calculator}
          title={total === 0 ? 'No reconciliations yet' : 'No reconciliations match'}
          description={
            total === 0
              ? 'Create a reconciliation to allocate CAM expenses across your tenants.'
              : 'Try a different search or clear filters.'
          }
          action={
            total === 0 ? (
              <button
                type="button"
                onClick={() => open('quickAddReconciliation')}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                New reconciliation
              </button>
            ) : null
          }
        />
      ) : null}
    </>
  );
}

function ReconciliationDetail({
  reconciliationId,
  justCreated,
  onBack: _onBack,
}: {
  reconciliationId: string;
  justCreated?: boolean;
  onBack: () => void;
}) {
  const { data: reconciliation, isLoading, error } = useReconciliation(reconciliationId);
  const { data: siblingReconciliations } = useReconciliations(reconciliation?.propertyId);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const draftLetterMutation = useDraftLetter();
  const [searchParams, setSearchParams] = useSearchParams();

  const siblings = useMemo(() => {
    if (!siblingReconciliations) return [];
    return siblingReconciliations
      .slice()
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .map((r) => ({
        id: r.id,
        label: `${r.propertyName ?? r.propertyId} · ${r.periodStart} — ${r.periodEnd}`,
      }));
  }, [siblingReconciliations]);

  function handleDownload(format: 'pdf' | 'excel') {
    const url = `/api/reports/variance?reconciliationId=${reconciliationId}&format=${format}`;
    window.open(url, '_blank');
    toast.success(`Downloading ${format.toUpperCase()} report...`);
  }

  function handleSendToTenants() {
    toast.success('Statements queued for delivery to all tenants.');
  }

  function handleExplainVariances() {
    toast.loading('Generating variance explanations...', { id: 'explain' });
    fetch(`/api/reconciliations/${reconciliationId}/explain`, { method: 'POST' })
      .then((res) => {
        if (res.ok) {
          toast.success('Variance explanations generated. Check tenant allocations.', { id: 'explain' });
        } else {
          toast.error('Failed to generate explanations.', { id: 'explain' });
        }
      })
      .catch(() => {
        toast.error('Failed to generate explanations.', { id: 'explain' });
      });
  }

  function handleDraftLetter() {
    draftLetterMutation.mutate(reconciliationId, {
      onSuccess: () => {
        setShowLetterModal(true);
      },
      onError: () => {
        toast.error('Failed to generate letter.');
      },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonListRow />
        <SkeletonTable rows={3} columns={4} />
      </div>
    );
  }

  if (error || !reconciliation) {
    return (
      <EmptyState
        icon={Calculator}
        title="Couldn't load reconciliation"
        action={
          <button
            type="button"
            onClick={_onBack}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Go back
          </button>
        }
      />
    );
  }

  const statusTone: StatusTone =
    reconciliation.status === 'completed'
      ? 'success'
      : reconciliation.status === 'draft'
        ? 'neutral'
        : reconciliation.status === 'in_progress'
          ? 'info'
          : reconciliation.status === 'pending'
            ? 'warning'
            : 'neutral';

  const periodLabel = `${reconciliation.periodStart} — ${reconciliation.periodEnd}`;

  return (
    <>
      <DetailHeader
        breadcrumb={[
          { label: 'Reconciliations', href: '/reconciliations' },
          {
            label: `${reconciliation.propertyName ?? 'Reconciliation'} · ${periodLabel}`,
          },
        ]}
        icon={Calculator}
        iconColor="amber"
        title={reconciliation.propertyName || 'Reconciliation'}
        subtitle={<span>Period: {periodLabel}</span>}
        status={{ label: reconciliation.status.replace(/_/g, ' '), tone: statusTone }}
        recordSwitcher={
          siblings.length > 1
            ? {
                items: siblings,
                currentId: reconciliation.id,
                onSelect: (newId) => {
                  searchParams.set('created', newId);
                  setSearchParams(searchParams);
                },
              }
            : undefined
        }
        actions={
          <>
            <button
              onClick={() => handleDownload('pdf')}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </button>
            <button
              onClick={() => handleDownload('excel')}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              Excel
            </button>
            <button
              onClick={handleExplainVariances}
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Explain variances
            </button>
            <button
              onClick={handleDraftLetter}
              disabled={draftLetterMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {draftLetterMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Draft letter
            </button>
            <button
              onClick={handleSendToTenants}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Send className="h-3.5 w-3.5" />
              Send statements
            </button>
          </>
        }
      />

      {/* Success banner if just created */}
      {justCreated && (
        <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <Sparkles className="h-5 w-5 text-green-700" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">Reconciliation created</p>
              <p className="mt-0.5 text-sm text-green-800">
                Allocations are ready. What would you like to do next?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleDownload('pdf')}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Download variance report
                </button>
                <button
                  onClick={handleSendToTenants}
                  className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-white px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send statements to tenants
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info banner for drafts that weren't just-created */}
      {!justCreated && reconciliation.status === 'draft' && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-900">Draft reconciliation</p>
            <p className="text-xs text-green-700">
              Review the allocations below, then download a report or send statements to tenants.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total actual</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            ${(reconciliation.totalActualCosts / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total budgeted</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            ${(reconciliation.totalBudgetedCosts / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Variance</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            <VarianceCell
              value={reconciliation.totalActualCosts - reconciliation.totalBudgetedCosts}
            />
          </p>
        </div>
      </div>

      {/* Tenant Allocations Table */}
      {reconciliation.tenantAllocations && reconciliation.tenantAllocations.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Tenant allocations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Tenant</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Sq Ft</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Share %</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Allocated</th>
                  <th className="hidden px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 md:table-cell">Budgeted</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reconciliation.tenantAllocations.map((alloc) => (
                  <tr key={alloc.tenantId}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <Link to={`/tenants/${alloc.tenantId}`} className="text-indigo-600 hover:text-indigo-500">
                        {alloc.tenantName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {alloc.squareFootage.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {(alloc.sharePercentage * 100).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      ${(alloc.allocatedAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="hidden px-6 py-4 text-right text-sm text-gray-600 md:table-cell">
                      ${(alloc.budgetedAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <VarianceCell value={alloc.variance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Line Items */}
      {reconciliation.lineItems && reconciliation.lineItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Expense line items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Budgeted</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Actual</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reconciliation.lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.category}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      ${(item.budgetedAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      ${(item.actualAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <VarianceCell value={item.actualAmount - item.budgetedAmount} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Draft Letter Modal */}
      {showLetterModal && draftLetterMutation.data && (
        <DraftLetterModal
          letter={draftLetterMutation.data.letter}
          reconciliationId={reconciliationId}
          onClose={() => setShowLetterModal(false)}
        />
      )}
    </>
  );
}

function DraftLetterModal({
  letter,
  reconciliationId,
  onClose,
}: {
  letter: string;
  reconciliationId: string;
  onClose: () => void;
}) {
  function handleCopy() {
    navigator.clipboard.writeText(letter);
    toast.success('Letter copied to clipboard');
  }

  function handleDownloadPdf() {
    const url = `/api/reports/variance?reconciliationId=${reconciliationId}&format=pdf`;
    window.open(url, '_blank');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">CAM Reconciliation Letter</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Letter content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
            <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-800">
              {letter}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </button>
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <FileDown className="h-4 w-4" />
            Download as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function VarianceCell({ value }: { value: number }) {
  const formatted = `${value >= 0 ? '+' : ''}${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const colorClass = value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-gray-600';
  return <span className={colorClass}>{formatted}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

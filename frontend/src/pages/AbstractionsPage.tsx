import { useState } from 'react';
import {
  FileText,
  Check,
  X,
  ArrowLeft,
  Pencil,
  CheckCircle2,
  Upload,
  Quote,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  usePendingAbstractions,
  useApproveAbstraction,
  useRejectAbstraction,
  useCorrectAbstraction,
  Abstraction,
  ExtractedTerm,
} from '@/hooks/useAbstractions';
import { SkeletonCard } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { useGlobalUI } from '@/hooks/useCommandPalette';

export function AbstractionsPage() {
  const [selectedAbstraction, setSelectedAbstraction] = useState<Abstraction | null>(null);

  if (selectedAbstraction) {
    return (
      <AbstractionReview
        abstraction={selectedAbstraction}
        onBack={() => setSelectedAbstraction(null)}
      />
    );
  }

  return <AbstractionQueue onSelect={setSelectedAbstraction} />;
}

function AbstractionQueue({ onSelect }: { onSelect: (a: Abstraction) => void }) {
  const { data: abstractions, isLoading, error } = usePendingAbstractions();
  const { open } = useGlobalUI();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Lease abstractions</h2>
        <p className="mt-1 text-sm text-gray-600">
          Review AI-extracted lease terms side-by-side with the source text.
          Approve, correct, or reject.
        </p>
      </div>

      {error && (
        <div className="py-8 text-center">
          <p className="text-red-600">Failed to load pending abstractions.</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      ) : abstractions && abstractions.length > 0 ? (
        <div className="space-y-3">
          {abstractions.map((abstraction) => (
            <button
              key={abstraction.id}
              type="button"
              onClick={() => onSelect(abstraction)}
              className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-5 text-left transition-all hover:border-indigo-300 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-full bg-indigo-50 p-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {abstraction.documentTitle || `Document ${abstraction.documentId}`}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {abstraction.propertyName && `${abstraction.propertyName}`}
                      {abstraction.tenantName && ` · ${abstraction.tenantName}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <ConfidenceBadge score={abstraction.confidenceScore} />
                  <span className="text-xs text-gray-500">
                    {(abstraction.extractedTerms?.length ?? 0)} terms
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up"
          description="No lease abstractions pending review. Upload a lease to trigger AI extraction."
          action={
            <button
              type="button"
              onClick={() => open('upload')}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Upload className="h-4 w-4" />
              Upload a lease
            </button>
          }
        />
      )}
    </div>
  );
}

/** Humanize snake_case / camelCase field names for display. */
function humanizeField(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function AbstractionReview({
  abstraction,
  onBack,
}: {
  abstraction: Abstraction;
  onBack: () => void;
}) {
  const [editedTerms, setEditedTerms] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(
    abstraction.extractedTerms?.[0]?.field ?? null,
  );

  const approveMutation = useApproveAbstraction();
  const rejectMutation = useRejectAbstraction();
  const correctMutation = useCorrectAbstraction();

  const extractedTerms = abstraction.extractedTerms ?? [];
  const selected = extractedTerms.find((t) => t.field === selectedField);

  function handleEditTerm(field: string, value: string) {
    setEditedTerms({ ...editedTerms, [field]: value });
  }

  function startEditing(field: string) {
    setEditingField(field);
    setSelectedField(field);
    if (!(field in editedTerms)) {
      const term = extractedTerms.find((t) => t.field === field);
      setEditedTerms({ ...editedTerms, [field]: String(term?.value ?? '') });
    }
  }

  function stopEditing() {
    setEditingField(null);
  }

  async function handleApprove() {
    try {
      if (Object.keys(editedTerms).length > 0) {
        const corrections = Object.entries(editedTerms).map(([fieldName, newValue]) => ({
          fieldName,
          newValue,
        }));
        await correctMutation.mutateAsync({
          abstractionId: abstraction.id,
          corrections,
        });
        toast.success(
          'Abstraction approved with corrections. Ready for reconciliation.',
          { duration: 5000 },
        );
      } else {
        await approveMutation.mutateAsync(abstraction.id);
        toast.success(
          'Abstraction approved. Ready for reconciliation.',
          { duration: 5000 },
        );
      }
      onBack();
    } catch {
      toast.error('Failed to approve abstraction.');
    }
  }

  async function handleReject() {
    try {
      await rejectMutation.mutateAsync(abstraction.id);
      toast.success('Abstraction rejected.');
      onBack();
    } catch {
      toast.error('Failed to reject abstraction.');
    }
  }

  const isSubmitting =
    approveMutation.isPending || rejectMutation.isPending || correctMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold text-gray-900">Review abstraction</h2>
            <p className="mt-1 truncate text-sm text-gray-600">
              {abstraction.documentTitle || `Document ${abstraction.documentId}`}
            </p>
          </div>
        </div>
        <ConfidenceBadge score={abstraction.confidenceScore} showLabel />
      </div>

      {/* Two-column: Terms | Source snippet */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Left: Extracted Terms */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white lg:col-span-3">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Extracted terms</h3>
            <p className="mt-1 text-xs text-gray-500">
              Click a term to see the source text it came from. Edit to correct.
            </p>
          </div>
          {extractedTerms.length === 0 ? (
            <p className="px-6 py-6 text-sm text-gray-500">
              No terms were extracted from this document.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {extractedTerms.map((term) => (
                <TermRow
                  key={term.field}
                  term={term}
                  isSelected={selectedField === term.field}
                  isEditing={editingField === term.field}
                  editedValue={editedTerms[term.field]}
                  onSelect={() => setSelectedField(term.field)}
                  onStartEdit={() => startEditing(term.field)}
                  onStopEdit={stopEditing}
                  onChangeValue={(val) => handleEditTerm(term.field, val)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Right: Source snippet */}
        <aside className="overflow-hidden rounded-lg border border-gray-200 bg-white lg:col-span-2">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">Source text</h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              The passage where this term was found.
            </p>
          </div>
          <div className="p-5">
            {selected ? (
              <SourceSnippet term={selected} />
            ) : (
              <p className="text-sm text-gray-500">Select a term to see its source.</p>
            )}
          </div>
        </aside>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <button
          onClick={handleReject}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Reject
        </button>
        <button
          onClick={handleApprove}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {Object.keys(editedTerms).length > 0 ? 'Approve with corrections' : 'Approve'}
        </button>
      </div>
    </div>
  );
}

function SourceSnippet({ term }: { term: ExtractedTerm }) {
  // The backend stores sourceText on extracted_terms. The frontend hook may not
  // always type it, so we read it defensively.
  const anyTerm = term as ExtractedTerm & { sourceText?: string; sourcePageNumber?: number };
  const sourceText = anyTerm.sourceText;
  const pageNumber = anyTerm.sourcePageNumber;
  const value = String(term.value ?? '');

  if (!sourceText) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
        <Quote className="mx-auto h-5 w-5 text-gray-300" />
        <p className="mt-2 text-xs text-gray-500">
          No source snippet was captured for this term. You can still edit or approve it.
        </p>
      </div>
    );
  }

  return (
    <div>
      {pageNumber ? (
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
          From page {pageNumber}
        </div>
      ) : null}
      <div className="rounded-md border border-amber-100 bg-amber-50/40 p-4 text-sm leading-6 text-gray-800">
        <Quote className="mb-2 h-4 w-4 text-amber-400" />
        <SnippetWithHighlight text={sourceText} value={value} />
      </div>
    </div>
  );
}

function SnippetWithHighlight({ text, value }: { text: string; value: string }) {
  if (!value || value === '—') return <>{text}</>;

  // Find the first occurrence of the value (case-insensitive) and highlight it.
  const lower = text.toLowerCase();
  const target = value.toLowerCase();
  const idx = lower.indexOf(target);
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200/80 px-0.5">{text.slice(idx, idx + value.length)}</mark>
      {text.slice(idx + value.length)}
    </>
  );
}

function TermRow({
  term,
  isSelected,
  isEditing,
  editedValue,
  onSelect,
  onStartEdit,
  onStopEdit,
  onChangeValue,
}: {
  term: ExtractedTerm;
  isSelected: boolean;
  isEditing: boolean;
  editedValue: string | undefined;
  onSelect: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChangeValue: (val: string) => void;
}) {
  const displayValue =
    editedValue !== undefined ? editedValue : String(term.value ?? '—');
  const hasBeenEdited = editedValue !== undefined;

  return (
    <li
      className={`flex cursor-pointer items-center gap-4 px-6 py-3 transition-colors ${
        isSelected ? 'bg-indigo-50/40' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="flex-shrink-0">
        <ConfidenceDot score={term.confidence} />
      </div>

      <div className="w-48 flex-shrink-0">
        <p className="text-sm font-medium text-gray-900">{humanizeField(term.field)}</p>
        <p className="text-xs text-gray-500">{(term.confidence * 100).toFixed(0)}% confidence</p>
      </div>

      <div className="flex-1">
        {isEditing ? (
          <input
            type="text"
            value={editedValue ?? ''}
            onChange={(e) => onChangeValue(e.target.value)}
            onBlur={onStopEdit}
            onKeyDown={(e) => e.key === 'Enter' && onStopEdit()}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="block w-full rounded-md border border-indigo-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        ) : (
          <p
            className={`text-sm ${
              hasBeenEdited ? 'font-medium text-indigo-700' : 'text-gray-900'
            }`}
          >
            {displayValue || '—'}
            {hasBeenEdited && <span className="ml-2 text-xs text-indigo-500">(edited)</span>}
          </p>
        )}
      </div>

      {!isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          className="flex-shrink-0 rounded p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
          aria-label={`Edit ${term.field}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function ConfidenceDot({ score }: { score: number }) {
  const color = score >= 0.85 ? 'bg-green-500' : score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div
      className={`h-3 w-3 rounded-full ${color}`}
      title={`${(score * 100).toFixed(0)}%`}
      aria-label={`confidence ${(score * 100).toFixed(0)}%`}
    />
  );
}

function ConfidenceBadge({ score, showLabel = false }: { score: number; showLabel?: boolean }) {
  const color =
    score >= 0.85
      ? 'bg-green-100 text-green-700'
      : score >= 0.6
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {showLabel && 'Confidence: '}
      {(score * 100).toFixed(0)}%
    </span>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ClipboardPaste,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Modal, ModalFooter } from './Modal';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';
import { useCreateReconciliation, ReconciliationLineItem } from '@/hooks/useReconciliations';

type Step = 1 | 2 | 3;

interface Line {
  category: string;
  /** Dollars, as entered by the user. */
  budgeted: string;
  actual: string;
}

const STARTER_LINES: Line[] = [
  { category: '', budgeted: '', actual: '' },
];

function periodDefaults() {
  const now = new Date();
  const year = now.getFullYear() - 1;
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

/**
 * 3-step wizard for creating a reconciliation:
 *   1. Property & period
 *   2. Add expenses (with paste-from-clipboard support)
 *   3. Review & confirm with allocation preview
 */
export function QuickAddReconciliationModal() {
  const { active, contexts, close } = useGlobalUI();
  const [step, setStep] = useState<Step>(1);
  const [propertyId, setPropertyId] = useState('');
  const [periodStart, setPeriodStart] = useState(periodDefaults().start);
  const [periodEnd, setPeriodEnd] = useState(periodDefaults().end);
  const [lines, setLines] = useState<Line[]>(STARTER_LINES);

  const { data: properties } = useProperties();
  const { data: tenants } = useTenants(propertyId || undefined);
  const createMutation = useCreateReconciliation();
  const navigate = useNavigate();

  // Reset when opened
  useEffect(() => {
    if (active === 'quickAddReconciliation') {
      setStep(1);
      setPropertyId(contexts.quickAddReconciliation?.propertyId ?? '');
      const { start, end } = periodDefaults();
      setPeriodStart(start);
      setPeriodEnd(end);
      setLines(STARTER_LINES);
    }
  }, [active, contexts]);

  function handleClose() {
    close();
  }

  const selectedProperty = properties?.find((p) => p.id === propertyId);

  const parsedLines: ReconciliationLineItem[] = useMemo(
    () =>
      lines
        .filter((l) => l.category.trim().length > 0)
        .map((l) => ({
          category: l.category.trim(),
          budgetedAmount: Math.round((Number(l.budgeted) || 0) * 100),
          actualAmount: Math.round((Number(l.actual) || 0) * 100),
        })),
    [lines],
  );

  const totalBudgeted = parsedLines.reduce((sum, l) => sum + l.budgetedAmount, 0);
  const totalActual = parsedLines.reduce((sum, l) => sum + l.actualAmount, 0);
  const totalSqft = (tenants ?? []).reduce((sum, t) => sum + t.squareFootage, 0);

  function goNext() {
    if (step === 1) {
      if (!propertyId) {
        toast.error('Select a property to continue.');
        return;
      }
      if (!periodStart || !periodEnd) {
        toast.error('Set the reconciliation period.');
        return;
      }
      if (new Date(periodStart) >= new Date(periodEnd)) {
        toast.error('Period end must be after period start.');
        return;
      }
    }
    if (step === 2) {
      if (parsedLines.length === 0) {
        toast.error('Add at least one expense line item.');
        return;
      }
    }
    setStep((s) => (Math.min(s + 1, 3) as Step));
  }

  function goBack() {
    setStep((s) => (Math.max(s - 1, 1) as Step));
  }

  function addLine() {
    setLines((existing) => [...existing, { category: '', budgeted: '', actual: '' }]);
  }

  function removeLine(index: number) {
    setLines((existing) => (existing.length === 1 ? existing : existing.filter((_, i) => i !== index)));
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((existing) => existing.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error('Clipboard is empty.');
        return;
      }
      const rows = text
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => row.split(/\t|,/));

      if (rows.length === 0) {
        toast.error('No rows found on clipboard.');
        return;
      }

      const parsed: Line[] = rows.map((cols) => ({
        category: (cols[0] || '').trim(),
        budgeted: (cols[1] || '').replace(/[$,]/g, '').trim(),
        actual: (cols[2] || '').replace(/[$,]/g, '').trim(),
      })).filter((l) => l.category);

      if (parsed.length === 0) {
        toast.error('Could not find any expense rows on the clipboard.');
        return;
      }

      setLines(parsed);
      toast.success(`Pasted ${parsed.length} line ${parsed.length === 1 ? 'item' : 'items'}.`);
    } catch {
      toast.error('Clipboard access was denied.');
    }
  }

  async function handleCreate() {
    try {
      const response = await createMutation.mutateAsync({
        propertyId,
        periodStart,
        periodEnd,
        lineItems: parsedLines,
      });

      toast.success('Reconciliation created.');
      close();
      // Navigate to the detail view so the user sees the success screen with
      // next-step CTAs (download report / send statements).
      const newId = response.data?.id;
      navigate(newId ? `/reconciliations?created=${newId}` : '/reconciliations');
    } catch {
      toast.error('Failed to create reconciliation.');
    }
  }

  const stepTitles: Record<Step, string> = {
    1: 'Select property & period',
    2: 'Add expense line items',
    3: 'Review & confirm',
  };

  return (
    <Modal
      open={active === 'quickAddReconciliation'}
      onClose={handleClose}
      title="New reconciliation"
      description={stepTitles[step]}
      size="xl"
    >
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="mt-4 space-y-4">
          <Field label="Property" required>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            >
              <option value="">Select a property...</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start" required>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </Field>
            <Field label="Period end" required>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </Field>
          </div>

          {selectedProperty && tenants && tenants.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-700">
                {tenants.length} {tenants.length === 1 ? 'tenant' : 'tenants'} will be included
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Pro-rata allocation is computed from each tenant's leased area.
              </p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Enter each expense category with its budgeted and actual amounts.
            </p>
            <button
              type="button"
              onClick={handlePaste}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              title="Paste from clipboard (category, budgeted, actual)"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Paste from clipboard
            </button>
          </div>

          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Budgeted ($)</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Actual ($)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={line.category}
                        placeholder="Maintenance"
                        onChange={(e) => updateLine(idx, { category: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={line.budgeted}
                        placeholder="0.00"
                        onChange={(e) => updateLine(idx, { budgeted: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={line.actual}
                        placeholder="0.00"
                        onChange={(e) => updateLine(idx, { actual: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Total</td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    ${(totalBudgeted / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    ${(totalActual / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Add line item
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Summary label="Property" value={selectedProperty?.name ?? '—'} />
            <Summary
              label="Period"
              value={`${periodStart} → ${periodEnd}`}
            />
            <Summary
              label="Total budgeted"
              value={`$${(totalBudgeted / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            />
            <Summary
              label="Total actual"
              value={`$${(totalActual / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            />
          </div>

          <div className="rounded-md border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-2">
              <h4 className="text-sm font-semibold text-gray-900">Allocation preview</h4>
              <p className="text-xs text-gray-500">
                Based on a pro-rata share of each tenant's leased area.
              </p>
            </div>
            {(tenants ?? []).length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-500">
                No tenants on this property yet — allocations will be generated after you add tenants.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Tenant</th>
                    <th className="px-4 py-2 text-right">Sqft</th>
                    <th className="px-4 py-2 text-right">Share %</th>
                    <th className="px-4 py-2 text-right">Allocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(tenants ?? []).map((t) => {
                    const share = totalSqft > 0 ? t.squareFootage / totalSqft : 0;
                    const allocated = totalActual * share;
                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-2 text-gray-900">{t.name}</td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {t.squareFootage.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {(share * 100).toFixed(2)}%
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          ${(allocated / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <ModalFooter>
        <div className="mr-auto text-xs text-gray-500">Step {step} of 3</div>
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {createMutation.isPending ? 'Creating...' : 'Create reconciliation'}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps = [1, 2, 3] as const;
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => (
        <div key={s} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              s < step
                ? 'bg-green-500 text-white'
                : s === step
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s < step ? '✓' : s}
          </div>
          <div className={`h-0.5 flex-1 rounded ${s < step ? 'bg-green-400' : 'bg-gray-200'}`} hidden={idx === steps.length - 1} />
        </div>
      ))}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

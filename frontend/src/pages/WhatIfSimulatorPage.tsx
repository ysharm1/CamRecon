import { useState, useCallback, useRef } from 'react';
import { Calculator, Plus, Trash2, Play, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';
import {
  useWhatIfSimulation,
  WhatIfLineItem,
  WhatIfTenant,
  WhatIfResult,
  AllocationMethod,
} from '@/hooks/useWhatIf';

const ALLOCATION_METHODS: { value: AllocationMethod; label: string }[] = [
  { value: 'pro_rata', label: 'Pro-Rata (Square Footage)' },
  { value: 'fixed_percentage', label: 'Fixed Percentage' },
  { value: 'base_year_stop', label: 'Base Year Stop' },
  { value: 'modified_gross', label: 'Modified Gross' },
];

export function WhatIfSimulatorPage() {
  const { data: properties } = useProperties();
  const [propertyId, setPropertyId] = useState('');
  const [totalLeasableArea, setTotalLeasableArea] = useState(10000);
  const [periodStart, setPeriodStart] = useState('2024-01-01');
  const [periodEnd, setPeriodEnd] = useState('2024-12-31');
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('pro_rata');
  const [grossUpEnabled, setGrossUpEnabled] = useState(false);
  const [targetOccupancy, setTargetOccupancy] = useState(95);
  const [exclusions, setExclusions] = useState('');

  const [lineItems, setLineItems] = useState<WhatIfLineItem[]>([
    { category: 'Maintenance', description: 'General maintenance', amountCents: 500000 },
    { category: 'Insurance', description: 'Property insurance', amountCents: 200000 },
    { category: 'Utilities', description: 'Common area utilities', amountCents: 150000 },
  ]);

  const [tenants, setTenants] = useState<WhatIfTenant[]>([
    { tenantId: 'tenant-1', tenantName: 'Tenant A', squareFootage: 3000, estimatedCAMCents: 250000 },
    { tenantId: 'tenant-2', tenantName: 'Tenant B', squareFootage: 4000, estimatedCAMCents: 340000 },
  ]);

  const [result, setResult] = useState<WhatIfResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: propertyTenants } = useTenants(propertyId || undefined);
  const simulation = useWhatIfSimulation();

  // Load tenants from property when selected
  const handlePropertyChange = useCallback((newPropertyId: string) => {
    setPropertyId(newPropertyId);
    const property = properties?.find((p) => p.id === newPropertyId);
    if (property) {
      setTotalLeasableArea(property.totalSquareFootage || 10000);
    }
  }, [properties]);

  // Load real tenants when property tenants are available
  const loadPropertyTenants = useCallback(() => {
    if (propertyTenants && propertyTenants.length > 0) {
      setTenants(
        propertyTenants.map((t) => ({
          tenantId: t.id,
          tenantName: t.name,
          squareFootage: t.squareFootage,
          estimatedCAMCents: 0,
        }))
      );
    }
  }, [propertyTenants]);

  // Run simulation
  const runSimulation = useCallback(() => {
    if (lineItems.length === 0 || tenants.length === 0) {
      toast.error('Add at least one expense and one tenant.');
      return;
    }

    const exclusionList = exclusions
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    simulation.mutate(
      {
        propertyId: propertyId || 'simulator',
        totalLeasableArea,
        periodStart,
        periodEnd,
        lineItems,
        tenants,
        options: {
          allocationMethod,
          grossUpEnabled,
          targetOccupancy: targetOccupancy / 100,
          exclusions: exclusionList,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data);
        },
        onError: () => {
          toast.error('Simulation failed. Check your inputs.');
        },
      }
    );
  }, [
    propertyId, totalLeasableArea, periodStart, periodEnd,
    lineItems, tenants, allocationMethod, grossUpEnabled,
    targetOccupancy, exclusions, simulation,
  ]);

  // Debounced auto-simulate
  const debouncedSimulate = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (lineItems.length > 0 && tenants.length > 0) {
        runSimulation();
      }
    }, 800);
  }, [runSimulation, lineItems.length, tenants.length]);

  // Line item handlers
  function addLineItem() {
    setLineItems([...lineItems, { category: '', description: '', amountCents: 0 }]);
  }

  function updateLineItem(index: number, field: keyof WhatIfLineItem, value: string | number) {
    const updated = [...lineItems];
    if (field === 'amountCents') {
      updated[index] = { ...updated[index], amountCents: Math.round(Number(value) * 100) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setLineItems(updated);
    debouncedSimulate();
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
    debouncedSimulate();
  }

  // Tenant handlers
  function addTenant() {
    const id = `tenant-${Date.now()}`;
    setTenants([...tenants, { tenantId: id, tenantName: '', squareFootage: 1000, estimatedCAMCents: 0 }]);
  }

  function updateTenant(index: number, field: keyof WhatIfTenant, value: string | number) {
    const updated = [...tenants];
    if (field === 'squareFootage' || field === 'estimatedCAMCents') {
      const numValue = field === 'estimatedCAMCents' ? Math.round(Number(value) * 100) : Number(value);
      updated[index] = { ...updated[index], [field]: numValue };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setTenants(updated);
    debouncedSimulate();
  }

  function removeTenant(index: number) {
    setTenants(tenants.filter((_, i) => i !== index));
    debouncedSimulate();
  }

  const totalExpenses = lineItems.reduce((sum, li) => sum + li.amountCents, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">What-If Simulator</h2>
          <p className="mt-1 text-sm text-gray-600">
            Simulate CAM allocations with different scenarios without affecting real data.
          </p>
        </div>
        <button
          onClick={runSimulation}
          disabled={simulation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {simulation.isPending ? 'Simulating...' : 'Simulate'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Panel: Inputs */}
        <div className="space-y-6">
          {/* Configuration */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Configuration</h3>

            <div className="space-y-4">
              {/* Property selector */}
              <div>
                <label htmlFor="sim-property" className="block text-sm font-medium text-gray-700">
                  Property (optional)
                </label>
                <div className="flex gap-2 mt-1">
                  <select
                    id="sim-property"
                    value={propertyId}
                    onChange={(e) => handlePropertyChange(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Custom (no property)</option>
                    {properties?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {propertyTenants && propertyTenants.length > 0 && (
                    <button
                      type="button"
                      onClick={loadPropertyTenants}
                      className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Load Tenants
                    </button>
                  )}
                </div>
              </div>

              {/* Total leasable area */}
              <div>
                <label htmlFor="sim-area" className="block text-sm font-medium text-gray-700">
                  Total Leasable Area (sq ft)
                </label>
                <input
                  id="sim-area"
                  type="number"
                  value={totalLeasableArea}
                  onChange={(e) => { setTotalLeasableArea(Number(e.target.value)); debouncedSimulate(); }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Allocation method */}
              <div>
                <label htmlFor="sim-method" className="block text-sm font-medium text-gray-700">
                  Allocation Method
                </label>
                <select
                  id="sim-method"
                  value={allocationMethod}
                  onChange={(e) => { setAllocationMethod(e.target.value as AllocationMethod); debouncedSimulate(); }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {ALLOCATION_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gross-up */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={grossUpEnabled}
                    onChange={(e) => { setGrossUpEnabled(e.target.checked); debouncedSimulate(); }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-gray-700">Gross-Up</span>
                </label>
                {grossUpEnabled && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={targetOccupancy}
                      onChange={(e) => { setTargetOccupancy(Number(e.target.value)); debouncedSimulate(); }}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600 w-12">{targetOccupancy}%</span>
                  </div>
                )}
              </div>

              {/* Exclusions */}
              <div>
                <label htmlFor="sim-exclusions" className="block text-sm font-medium text-gray-700">
                  Excluded Categories (comma-separated)
                </label>
                <input
                  id="sim-exclusions"
                  type="text"
                  value={exclusions}
                  onChange={(e) => { setExclusions(e.target.value); debouncedSimulate(); }}
                  placeholder="e.g., Capital Improvements, Management Fees"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sim-start" className="block text-sm font-medium text-gray-700">Start</label>
                  <input
                    id="sim-start"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="sim-end" className="block text-sm font-medium text-gray-700">End</label>
                  <input
                    id="sim-end"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Expense Line Items */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Expense Line Items
                <span className="ml-2 text-xs font-normal text-gray-500">
                  Total: ${(totalExpenses / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </h3>
              <button
                type="button"
                onClick={addLineItem}
                className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Category</label>}
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) => updateLineItem(index, 'category', e.target.value)}
                      placeholder="Category"
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-4">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-3">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>}
                    <input
                      type="number"
                      step="0.01"
                      value={(item.amountCents / 100).toFixed(2)}
                      onChange={(e) => updateLineItem(index, 'amountCents', e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">&nbsp;</label>}
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tenants */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Tenants</h3>
              <button
                type="button"
                onClick={addTenant}
                className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                <Plus className="h-3 w-3" /> Add Tenant
              </button>
            </div>
            <div className="space-y-3">
              {tenants.map((tenant, index) => (
                <div key={tenant.tenantId} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Name</label>}
                    <input
                      type="text"
                      value={tenant.tenantName || ''}
                      onChange={(e) => updateTenant(index, 'tenantName', e.target.value)}
                      placeholder="Tenant name"
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-3">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Sq Ft</label>}
                    <input
                      type="number"
                      value={tenant.squareFootage}
                      onChange={(e) => updateTenant(index, 'squareFootage', e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-4">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Estimated CAM ($)</label>}
                    <input
                      type="number"
                      step="0.01"
                      value={(tenant.estimatedCAMCents / 100).toFixed(2)}
                      onChange={(e) => updateTenant(index, 'estimatedCAMCents', e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">&nbsp;</label>}
                    <button
                      type="button"
                      onClick={() => removeTenant(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      aria-label="Remove tenant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="space-y-6">
          {result ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500">Total Expenses</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    ${(result.totalExpensesCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  {result.grossUpApplied && (
                    <p className="text-xs text-amber-600 mt-1">
                      Gross-up applied (original: ${(result.originalTotalExpensesCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500">Method</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {ALLOCATION_METHODS.find((m) => m.value === result.appliedMethod)?.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {result.isBalanced ? '✓ Balanced' : '⚠ Unbalanced'}
                  </p>
                </div>
              </div>

              {result.excludedCategories.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-800">
                    Excluded: {result.excludedCategories.join(', ')}
                  </p>
                </div>
              )}

              {/* Allocations Table */}
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Simulated Allocations</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Tenant</th>
                        <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Sq Ft</th>
                        <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Share</th>
                        <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Allocated</th>
                        <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Estimated</th>
                        <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {result.allocations.map((alloc, idx) => {
                        const tenant = tenants.find((t) => t.tenantId === alloc.tenantId);
                        const varianceColor =
                          alloc.varianceCents > 0
                            ? 'text-red-600'
                            : alloc.varianceCents < 0
                            ? 'text-green-600'
                            : 'text-gray-600';
                        return (
                          <tr key={alloc.tenantId || idx}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {tenant?.tenantName || alloc.tenantId}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              {alloc.squareFootage.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              {(alloc.sharePercentage * 100).toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                              ${(alloc.actualAmountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              ${(alloc.estimatedAmountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`px-4 py-3 text-sm font-medium text-right ${varianceColor}`}>
                              {alloc.varianceCents >= 0 ? '+' : ''}
                              ${(alloc.varianceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-2 text-sm font-semibold text-gray-900">Total</td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">
                          {result.allocations.reduce((s, a) => s + a.squareFootage, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">
                          {(result.allocations.reduce((s, a) => s + a.sharePercentage, 0) * 100).toFixed(2)}%
                        </td>
                        <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                          ${(result.allocations.reduce((s, a) => s + a.actualAmountCents, 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">
                          ${(result.allocations.reduce((s, a) => s + a.estimatedAmountCents, 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-right">
                          {(() => {
                            const totalVariance = result.allocations.reduce((s, a) => s + a.varianceCents, 0);
                            const color = totalVariance > 0 ? 'text-red-600' : totalVariance < 0 ? 'text-green-600' : 'text-gray-600';
                            return (
                              <span className={color}>
                                {totalVariance >= 0 ? '+' : ''}${(totalVariance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <Calculator className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm text-gray-500">
                Configure your scenario and click Simulate to see results.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Results update automatically as you change inputs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

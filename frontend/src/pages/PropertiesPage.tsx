import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowUpDown, Plus, Eye, UserPlus, Calculator } from 'lucide-react';
import { useProperties } from '@/hooks/useProperties';
import { SkeletonTable } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { RowActions } from '@/components/RowActions';
import { IndexHeader } from '@/components/IndexHeader';
import { useGlobalUI } from '@/hooks/useCommandPalette';

type SortField = 'name' | 'propertyType' | 'totalSquareFootage';
type SortDir = 'asc' | 'desc';

export function PropertiesPage() {
  const { data: properties, isLoading, error, refetch } = useProperties();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const navigate = useNavigate();
  const { open } = useGlobalUI();

  const filtered = useMemo(() => {
    if (!properties) return [];
    const q = search.trim().toLowerCase();
    let result = properties.filter((p) => {
      if (typeFilter && p.propertyType !== typeFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || p.propertyType.toLowerCase().includes(q)
      );
    });
    result = result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
    return result;
  }, [properties, search, typeFilter, sortField, sortDir]);

  const propertyTypes = useMemo(() => {
    if (!properties) return [];
    return Array.from(new Set(properties.map((p) => p.propertyType))).sort();
  }, [properties]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  if (error) {
    return (
      <EmptyState
        icon={Building2}
        title="Failed to load properties"
        description="Something went wrong fetching your portfolio."
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

  const total = properties?.length ?? 0;
  const showing = filtered.length;
  const activeFilters = [
    ...(typeFilter
      ? [{ label: `Type: ${typeFilter}`, onRemove: () => setTypeFilter('') }]
      : []),
    ...(search
      ? [{ label: `Search: "${search}"`, onRemove: () => setSearch('') }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <IndexHeader
        title="Properties"
        description="Manage your property portfolio."
        count={total}
        primaryAction={{
          label: 'New property',
          icon: Plus,
          onClick: () => open('quickAddProperty'),
        }}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search properties...',
        }}
        filters={
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All types</option>
            {propertyTypes.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
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

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={total === 0 ? 'No properties yet' : 'No properties match'}
          description={
            total === 0
              ? 'Add your first property to start tracking tenants, leases, and reconciliations.'
              : 'Try a different search term or clear filters.'
          }
          action={
            total === 0 ? (
              <button
                type="button"
                onClick={() => open('quickAddProperty')}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add your first property
              </button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white sm:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader
                    label="Name"
                    field="name"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Type"
                    field="propertyType"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Total area"
                    field="totalSquareFootage"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tenants
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Occupancy
                  </th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((property) => (
                  <tr
                    key={property.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <Link
                          to={`/properties/${property.id}`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {property.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-700">
                      {property.propertyType}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {property.totalSquareFootage.toLocaleString()} sqft
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {property.tenantCount ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {property.occupancyRate != null
                        ? `${(property.occupancyRate * 100).toFixed(0)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        actions={[
                          {
                            label: 'View details',
                            icon: Eye,
                            onClick: () => navigate(`/properties/${property.id}`),
                          },
                          {
                            label: 'Add tenant',
                            icon: UserPlus,
                            onClick: () =>
                              open('quickAddTenant', {
                                quickAddTenant: { propertyId: property.id },
                              }),
                          },
                          {
                            label: 'New reconciliation',
                            icon: Calculator,
                            onClick: () =>
                              open('quickAddReconciliation', {
                                quickAddReconciliation: { propertyId: property.id },
                              }),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="space-y-2 sm:hidden">
            {filtered.map((property) => (
              <li
                key={property.id}
                className="rounded-lg border border-gray-200 bg-white p-4 active:bg-gray-50"
              >
                <Link to={`/properties/${property.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-indigo-600">{property.name}</span>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-700">
                      {property.propertyType}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {property.totalSquareFootage.toLocaleString()} sqft
                    {property.address ? ` · ${property.address.city}, ${property.address.state}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentField === field;
  return (
    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-gray-700"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
        {isActive && (
          <span className="text-[10px] text-indigo-600">
            {currentDir === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </th>
  );
}

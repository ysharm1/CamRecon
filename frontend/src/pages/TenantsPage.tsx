import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Eye, FileText, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenants } from '@/hooks/useTenants';
import { useProperties } from '@/hooks/useProperties';
import { SkeletonTable } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { RowActions } from '@/components/RowActions';
import { IndexHeader } from '@/components/IndexHeader';
import { useGlobalUI } from '@/hooks/useCommandPalette';

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: tenants, isLoading, error, refetch } = useTenants(propertyFilter || undefined);
  const { data: properties } = useProperties();
  const navigate = useNavigate();
  const { open } = useGlobalUI();

  const filtered = useMemo(() => {
    if (!tenants) return [];
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.suiteNumber.toLowerCase().includes(q) ||
        t.contactEmail.toLowerCase().includes(q)
      );
    });
  }, [tenants, search, statusFilter]);

  if (error) {
    return (
      <EmptyState
        icon={Users}
        title="Failed to load tenants"
        description="Something went wrong fetching tenant data."
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

  const total = tenants?.length ?? 0;
  const showing = filtered.length;
  const propertyName = properties?.find((p) => p.id === propertyFilter)?.name;

  const activeFilters = [
    ...(propertyFilter && propertyName
      ? [{ label: `Property: ${propertyName}`, onRemove: () => setPropertyFilter('') }]
      : []),
    ...(statusFilter
      ? [{ label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter('') }]
      : []),
    ...(search
      ? [{ label: `Search: "${search}"`, onRemove: () => setSearch('') }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <IndexHeader
        title="Tenants"
        description="View and manage tenant information."
        count={total}
        primaryAction={{
          label: 'Add tenant',
          icon: Plus,
          onClick: () => open('quickAddTenant'),
        }}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search tenants...',
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
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
        <SkeletonTable rows={6} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={total === 0 ? 'No tenants yet' : 'No tenants match'}
          description={
            total === 0
              ? 'Add a tenant to an existing property to get started.'
              : 'Try a different search or clear filters.'
          }
          action={
            total === 0 ? (
              <button
                type="button"
                onClick={() => open('quickAddTenant')}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add your first tenant
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
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Suite</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Area</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/tenants/${tenant.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <Link
                          to={`/tenants/${tenant.id}`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {tenant.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {tenant.propertyName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{tenant.suiteNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {tenant.squareFootage.toLocaleString()} sqft
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        actions={[
                          {
                            label: 'View details',
                            icon: Eye,
                            onClick: () => navigate(`/tenants/${tenant.id}`),
                          },
                          {
                            label: 'View lease',
                            icon: FileText,
                            onClick: () => navigate(`/tenants/${tenant.id}`),
                          },
                          {
                            label: 'Send statement',
                            icon: Mail,
                            onClick: () =>
                              toast.success(`Statement will be emailed to ${tenant.contactEmail}`),
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
            {filtered.map((tenant) => (
              <li
                key={tenant.id}
                className="rounded-lg border border-gray-200 bg-white p-4 active:bg-gray-50"
              >
                <Link to={`/tenants/${tenant.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{tenant.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {tenant.propertyName} · Suite {tenant.suiteNumber}
                      </p>
                    </div>
                    <StatusBadge status={tenant.status} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {tenant.squareFootage.toLocaleString()} sqft · {tenant.contactEmail}
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        colors[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status}
    </span>
  );
}

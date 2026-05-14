import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, Plus, Eye, FileText, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenants } from '@/hooks/useTenants';
import { useProperties } from '@/hooks/useProperties';
import { SkeletonTable } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { RowActions } from '@/components/RowActions';
import { useGlobalUI } from '@/hooks/useCommandPalette';

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const { data: tenants, isLoading, error, refetch } = useTenants(propertyFilter || undefined);
  const { data: properties } = useProperties();
  const navigate = useNavigate();
  const { open } = useGlobalUI();

  const filtered = useMemo(() => {
    if (!tenants) return [];
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.suiteNumber.toLowerCase().includes(q) ||
        t.contactEmail.toLowerCase().includes(q),
    );
  }, [tenants, search]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Tenants</h2>
          <p className="mt-1 text-sm text-gray-600">View and manage tenant information.</p>
        </div>
        <button
          type="button"
          onClick={() => open('quickAddTenant')}
          className="inline-flex items-center gap-2 self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All properties</option>
          {properties?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={6} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tenants && tenants.length === 0 ? 'No tenants yet' : 'No tenants match'}
          description={
            tenants && tenants.length === 0
              ? 'Add a tenant to an existing property to get started.'
              : 'Try a different search or clear the property filter.'
          }
          action={
            tenants && tenants.length === 0 ? (
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

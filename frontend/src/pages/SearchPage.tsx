import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearch, SearchParams } from '@/hooks/useSearch';
import { useProperties } from '@/hooks/useProperties';
import { SkeletonCard } from '@/components/SkeletonCard';
import { IndexHeader } from '@/components/IndexHeader';

const DOCUMENT_TYPES = ['lease', 'amendment', 'correspondence', 'financial', 'insurance', 'other'];
const PAGE_SIZE = 20;

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<{
    propertyId?: string;
    documentType?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({});
  const [page, setPage] = useState(1);

  const { data: properties } = useProperties();

  const searchParams: SearchParams = {
    q: query,
    propertyId: filters.propertyId,
    documentType: filters.documentType,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data: searchResults, isLoading, error } = useSearch(searchParams);

  function handleFilterChange(key: keyof typeof filters, value: string) {
    setFilters({ ...filters, [key]: value || undefined });
    setPage(1);
  }

  const propertyName = properties?.find((p) => p.id === filters.propertyId)?.name;

  const activeFilters = [
    ...(filters.propertyId && propertyName
      ? [{ label: `Property: ${propertyName}`, onRemove: () => handleFilterChange('propertyId', '') }]
      : []),
    ...(filters.documentType
      ? [{
          label: `Type: ${filters.documentType}`,
          onRemove: () => handleFilterChange('documentType', ''),
        }]
      : []),
    ...(filters.dateFrom
      ? [{
          label: `From: ${filters.dateFrom}`,
          onRemove: () => handleFilterChange('dateFrom', ''),
        }]
      : []),
    ...(filters.dateTo
      ? [{
          label: `To: ${filters.dateTo}`,
          onRemove: () => handleFilterChange('dateTo', ''),
        }]
      : []),
  ];

  const total = searchResults?.total ?? 0;
  const showing = searchResults?.results.length ?? 0;
  const resultLabel = query
    ? total > 0
      ? `Showing ${showing} of ${total}`
      : 'No results'
    : undefined;

  return (
    <div className="space-y-6">
      <IndexHeader
        title="Search"
        description="Search across documents, properties, and lease terms."
        search={{
          value: query,
          onChange: (v) => {
            setQuery(v);
            setPage(1);
          },
          placeholder: 'Search documents, leases, properties...',
        }}
        filters={
          <>
            <select
              value={filters.propertyId || ''}
              onChange={(e) => handleFilterChange('propertyId', e.target.value)}
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
              value={filters.documentType || ''}
              onChange={(e) => handleFilterChange('documentType', e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All types</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              placeholder="From"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              placeholder="To"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </>
        }
        activeFilters={activeFilters}
        resultLabel={resultLabel}
      />

      {/* Results */}
      {error && (
        <div className="text-center py-8">
          <p className="text-red-600">Search failed. Please try again.</p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      )}

      {!isLoading && query && searchResults && (
        <>
          {searchResults.results.length > 0 ? (
            <div className="space-y-3">
              {searchResults.results.map((result) => (
                <Link
                  key={result.id}
                  to={`/documents/${result.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </h3>
                        <span className="flex-shrink-0 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {result.documentType}
                        </span>
                      </div>
                      {result.snippet && (
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">{result.snippet}</p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        {result.propertyName && <span>{result.propertyName}</span>}
                        <span>Modified {new Date(result.lastModified).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-lg border border-gray-200 bg-white">
              <Search className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">No results found.</p>
              <p className="mt-1 text-xs text-gray-500">
                Try different keywords or adjust your filters.
              </p>
            </div>
          )}

          {/* Pagination */}
          {searchResults.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-sm text-gray-600">
                Page {searchResults.page} of {searchResults.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= searchResults.totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state before search */}
      {!query && !isLoading && (
        <div className="text-center py-16 rounded-lg border border-gray-200 bg-white">
          <Search className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-600">
            Enter a search term to find documents across your portfolio.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Search by document title, content, property name, or tenant.
          </p>
        </div>
      )}
    </div>
  );
}

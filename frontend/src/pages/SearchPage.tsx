import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearch, SearchParams } from '@/hooks/useSearch';
import { useProperties } from '@/hooks/useProperties';
import { SkeletonCard } from '@/components/SkeletonCard';

const DOCUMENT_TYPES = ['lease', 'amendment', 'correspondence', 'financial', 'insurance', 'other'];
const PAGE_SIZE = 20;

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filters, setFilters] = useState<{
    propertyId?: string;
    documentType?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data: properties } = useProperties();

  const searchParams: SearchParams = {
    q: submittedQuery,
    propertyId: filters.propertyId,
    documentType: filters.documentType,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data: searchResults, isLoading, error } = useSearch(searchParams);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(query);
    setPage(1);
  }

  function handleFilterChange(key: string, value: string) {
    setFilters({ ...filters, [key]: value || undefined });
    setPage(1);
  }

  function clearFilters() {
    setFilters({});
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Search</h2>
        <p className="mt-1 text-sm text-gray-600">
          Search across documents, properties, and lease terms.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, leases, properties..."
            className="block w-full rounded-md border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium ${
            hasActiveFilters
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs text-white">
              {Object.values(filters).filter(Boolean).length}
            </span>
          )}
        </button>
      </form>

      {/* Filters panel */}
      {showFilters && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="filter-property" className="block text-xs font-medium text-gray-600 mb-1">
                Property
              </label>
              <select
                id="filter-property"
                value={filters.propertyId || ''}
                onChange={(e) => handleFilterChange('propertyId', e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Properties</option>
                {properties?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-type" className="block text-xs font-medium text-gray-600 mb-1">
                Document Type
              </label>
              <select
                id="filter-type"
                value={filters.documentType || ''}
                onChange={(e) => handleFilterChange('documentType', e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Types</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-date-from" className="block text-xs font-medium text-gray-600 mb-1">
                Date From
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-date-to" className="block text-xs font-medium text-gray-600 mb-1">
                Date To
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

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

      {!isLoading && submittedQuery && searchResults && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} for &ldquo;{submittedQuery}&rdquo;
            </p>
          </div>

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
      {!submittedQuery && !isLoading && (
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

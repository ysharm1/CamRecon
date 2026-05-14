import db from '../db';
import { SearchQuery, SearchResult, SearchResponse } from './search.types';

/**
 * Search service using PostgreSQL ILIKE for demo purposes.
 * In production, this would use Elasticsearch for full-text search.
 */
export const searchService = {
  /**
   * Execute a search query against the documents table.
   * Joins with properties and tenants to return enriched results.
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const { textQuery, propertyId, tenantId, documentType, dateFrom, dateTo, page, pageSize } = query;

    const offset = (page - 1) * pageSize;

    // Base query: documents joined with properties and optionally tenants
    let baseQuery = db('documents')
      .join('properties', 'documents.property_id', 'properties.id')
      .leftJoin('tenants', 'documents.tenant_id', 'tenants.id')
      .where('documents.title', 'ILIKE', `%${textQuery}%`);

    // Apply optional filters
    if (propertyId) {
      baseQuery = baseQuery.where('documents.property_id', propertyId);
    }

    if (tenantId) {
      baseQuery = baseQuery.where('documents.tenant_id', tenantId);
    }

    if (documentType) {
      baseQuery = baseQuery.where('documents.document_type', documentType);
    }

    if (dateFrom) {
      baseQuery = baseQuery.where('documents.updated_at', '>=', dateFrom);
    }

    if (dateTo) {
      baseQuery = baseQuery.where('documents.updated_at', '<=', dateTo);
    }

    // Get total count
    const countResult = await baseQuery.clone().count('documents.id as count').first();
    const totalCount = Number(countResult?.count ?? 0);

    // Get paginated results
    const rows = await baseQuery
      .clone()
      .select(
        'documents.id as document_id',
        'documents.title',
        'documents.document_type',
        'documents.updated_at',
        'properties.name as property_name',
        'tenants.name as tenant_name'
      )
      .orderBy('documents.updated_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const results: SearchResult[] = rows.map((row: Record<string, unknown>) => ({
      documentId: row.document_id as string,
      title: row.title as string,
      snippet: ((row.title as string) || '').substring(0, 200),
      documentType: row.document_type as string,
      propertyName: row.property_name as string,
      tenantName: (row.tenant_name as string) || null,
      lastModified: (row.updated_at as Date)?.toISOString?.() ?? String(row.updated_at),
    }));

    return {
      results,
      totalCount,
      page,
      pageSize,
      hasMore: page * pageSize < totalCount,
    };
  },
};

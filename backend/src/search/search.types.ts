/**
 * Search module types.
 */

export interface SearchQuery {
  textQuery: string;
  propertyId?: string;
  tenantId?: string;
  documentType?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface SearchResult {
  documentId: string;
  title: string;
  snippet: string;
  documentType: string;
  propertyName: string;
  tenantName: string | null;
  lastModified: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

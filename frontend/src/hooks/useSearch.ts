import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  documentType: string;
  propertyId: string;
  propertyName?: string;
  lastModified: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchParams {
  q: string;
  propertyId?: string;
  documentType?: string;
  page?: number;
  pageSize?: number;
}

export function useSearch(params: SearchParams) {
  return useQuery<SearchResponse>({
    queryKey: ['search', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q);
      if (params.propertyId) searchParams.set('propertyId', params.propertyId);
      if (params.documentType) searchParams.set('documentType', params.documentType);
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());

      const response = await api.get<{ data: SearchResponse }>(`/api/search?${searchParams.toString()}`);
      return response.data;
    },
    enabled: !!params.q,
  });
}

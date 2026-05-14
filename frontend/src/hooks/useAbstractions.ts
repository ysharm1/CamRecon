import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ExtractedTerm {
  field: string;
  value: string | number | null;
  confidence: number;
  /** Optional source snippet where the term was found in the document. */
  sourceText?: string;
  /** Optional 1-indexed page number the term was found on. */
  sourcePageNumber?: number;
}

export interface Abstraction {
  id: string;
  documentId: string;
  documentTitle?: string;
  propertyName?: string;
  tenantName?: string;
  status: string;
  confidenceScore: number;
  extractedTerms: ExtractedTerm[];
  createdAt: string;
  updatedAt: string;
}

export function usePendingAbstractions() {
  return useQuery<Abstraction[]>({
    queryKey: ['abstractions', 'pending'],
    queryFn: async () => {
      const response = await api.get<{ data: Abstraction[] }>('/api/abstractions/pending');
      return response.data;
    },
  });
}

export function useAbstraction(documentId: string) {
  return useQuery<Abstraction>({
    queryKey: ['abstractions', documentId],
    queryFn: async () => {
      const response = await api.get<{ data: Abstraction }>(`/api/abstractions/${documentId}`);
      return response.data;
    },
    enabled: !!documentId,
  });
}

/**
 * Optimistic approve: immediately remove the abstraction from the pending list
 * so the UI feels instant. Rolls back on error.
 */
export function useApproveAbstraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (abstractionId: string) => {
      return api.put(`/api/abstractions/${abstractionId}/approve`);
    },
    onMutate: async (abstractionId) => {
      await queryClient.cancelQueries({ queryKey: ['abstractions', 'pending'] });
      const previous = queryClient.getQueryData<Abstraction[]>(['abstractions', 'pending']);
      queryClient.setQueryData<Abstraction[]>(['abstractions', 'pending'], (old) =>
        (old ?? []).filter((a) => a.id !== abstractionId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['abstractions', 'pending'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['abstractions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRejectAbstraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (abstractionId: string) => {
      return api.put(`/api/abstractions/${abstractionId}/reject`);
    },
    onMutate: async (abstractionId) => {
      await queryClient.cancelQueries({ queryKey: ['abstractions', 'pending'] });
      const previous = queryClient.getQueryData<Abstraction[]>(['abstractions', 'pending']);
      queryClient.setQueryData<Abstraction[]>(['abstractions', 'pending'], (old) =>
        (old ?? []).filter((a) => a.id !== abstractionId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['abstractions', 'pending'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['abstractions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCorrectAbstraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      abstractionId,
      corrections,
    }: {
      abstractionId: string;
      corrections: { fieldName: string; newValue: string | number | null }[];
    }) => {
      return api.put(`/api/abstractions/${abstractionId}/correct`, { corrections });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abstractions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * AI Hooks
 *
 * React Query mutations and queries for AI-powered features.
 * Mutations are user-triggered (not auto-fetch) to avoid unnecessary API calls.
 * Queries with long staleTime are used for cached results.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeaseSummaryResult {
  summary: string;
  source: 'ai' | 'template';
  cached?: boolean;
}

export interface RenewalRiskResult {
  tenantId: string;
  tenantName: string;
  riskAssessment: string;
  daysUntilExpiration: number;
  source: 'ai' | 'template';
}

export interface DocumentInsightsResult {
  summary: string;
  risks: string[];
  source: 'ai' | 'template';
}

export interface VarianceExplanation {
  tenantId: string;
  explanation: string;
  variancePercentage: number;
}

export interface RenewalRisk {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  expirationDate: string;
  noticeDays: number;
  daysUntilExpiry: number;
  status: 'missed' | 'urgent' | 'upcoming';
  message: string;
}

export interface RenewalRisksResponse {
  risks: RenewalRisk[];
}

export interface DraftLetterResult {
  letter: string;
  format: 'text';
}

export interface AbstractionSummaryResult {
  summary: string;
  source: 'ai' | 'template';
  cached: boolean;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Generate an AI lease summary for a tenant.
 * User-triggered mutation — call mutate(tenantId) to generate.
 */
export function useLeaseSummary() {
  return useMutation<LeaseSummaryResult, Error, string>({
    mutationFn: async (tenantId: string) => {
      const response = await api.post<{ data: LeaseSummaryResult }>('/api/ai/lease-summary', { tenantId });
      return response.data;
    },
  });
}

/**
 * Generate a summary for a document's abstraction.
 * User-triggered mutation — call mutate(documentId) to generate.
 */
export function useAbstractionSummary() {
  return useMutation<AbstractionSummaryResult, Error, string>({
    mutationFn: async (documentId: string) => {
      const response = await api.post<{ data: AbstractionSummaryResult }>(`/api/abstractions/${documentId}/summarize`);
      return response.data;
    },
  });
}

/**
 * Fetch cached abstraction summary for a document.
 * Uses long staleTime to avoid re-fetching on every page load.
 */
export function useAbstractionSummaryQuery(documentId: string | undefined) {
  return useQuery<AbstractionSummaryResult | null>({
    queryKey: ['abstraction-summary', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      try {
        const response = await api.post<{ data: AbstractionSummaryResult }>(`/api/abstractions/${documentId}/summarize`);
        return response.data;
      } catch {
        return null;
      }
    },
    enabled: !!documentId,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: false,
  });
}

/**
 * Generate a renewal risk assessment for a tenant.
 * User-triggered mutation — call mutate(tenantId) to generate.
 */
export function useRenewalRisk() {
  return useMutation<RenewalRiskResult, Error, string>({
    mutationFn: async (tenantId: string) => {
      const response = await api.post<{ data: RenewalRiskResult }>('/api/ai/renewal-risk', { tenantId });
      return response.data;
    },
  });
}

/**
 * Fetch renewal risks for the dashboard.
 * Uses long staleTime since this is date-math based and doesn't change frequently.
 */
export function useRenewalRisks() {
  return useQuery<RenewalRisksResponse>({
    queryKey: ['renewal-risks'],
    queryFn: async () => {
      const response = await api.post<{ data: RenewalRisksResponse }>('/api/dashboard/renewal-risks');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Generate AI insights for a document.
 * User-triggered mutation — call mutate(documentId) to generate.
 */
export function useDocumentInsights() {
  return useMutation<DocumentInsightsResult, Error, string>({
    mutationFn: async (documentId: string) => {
      const response = await api.post<{ data: DocumentInsightsResult }>('/api/ai/document-insights', { documentId });
      return response.data;
    },
  });
}

/**
 * Generate variance explanations for a reconciliation.
 * Returns explanations inline for display in the allocations table.
 */
export function useVarianceExplanations() {
  const queryClient = useQueryClient();

  return useMutation<VarianceExplanation[], Error, string>({
    mutationFn: async (reconciliationId: string) => {
      const response = await api.post<{ data: VarianceExplanation[] }>(
        `/api/reconciliations/${reconciliationId}/explain`
      );
      return response.data;
    },
    onSuccess: (_, reconciliationId) => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations', reconciliationId] });
    },
  });
}

/**
 * Generate a draft CAM reconciliation letter.
 * User-triggered mutation — call mutate(reconciliationId) to generate.
 */
export function useDraftLetter() {
  return useMutation<DraftLetterResult, Error, string>({
    mutationFn: async (reconciliationId: string) => {
      const response = await api.post<{ data: DraftLetterResult }>(
        `/api/reconciliations/${reconciliationId}/draft-letter`
      );
      return response.data;
    },
  });
}

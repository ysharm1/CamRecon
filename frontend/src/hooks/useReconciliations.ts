import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReconciliationLineItem {
  category: string;
  budgetedAmount: number;
  actualAmount: number;
}

export interface TenantAllocation {
  tenantId: string;
  tenantName: string;
  squareFootage: number;
  sharePercentage: number;
  allocatedAmount: number;
  budgetedAmount: number;
  variance: number;
  variancePercentage: number;
}

export interface Reconciliation {
  id: string;
  propertyId: string;
  propertyName?: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalActualCosts: number;
  totalBudgetedCosts: number;
  lineItems: ReconciliationLineItem[];
  tenantAllocations: TenantAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationSummary {
  id: string;
  propertyId: string;
  propertyName?: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalActualCosts: number;
  createdAt: string;
}

export function useReconciliations(propertyId?: string) {
  return useQuery<ReconciliationSummary[]>({
    queryKey: ['reconciliations', { propertyId }],
    queryFn: async () => {
      const params = propertyId ? `?propertyId=${propertyId}` : '';
      const response = await api.get<{ data: ReconciliationSummary[] }>(`/api/reconciliations${params}`);
      return response.data;
    },
  });
}

export function useReconciliation(reconciliationId: string) {
  return useQuery<Reconciliation>({
    queryKey: ['reconciliations', reconciliationId],
    queryFn: async () => {
      const response = await api.get<{ data: Reconciliation }>(`/api/reconciliations/${reconciliationId}`);
      return response.data;
    },
    enabled: !!reconciliationId,
  });
}

export interface CreateReconciliationInput {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  lineItems: ReconciliationLineItem[];
}

export function useCreateReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReconciliationInput) => {
      return api.post<{ data: Reconciliation }>('/api/reconciliations', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
    },
  });
}

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WhatIfLineItem {
  category: string;
  description: string;
  amountCents: number;
}

export interface WhatIfTenant {
  tenantId: string;
  tenantName?: string;
  squareFootage: number;
  estimatedCAMCents: number;
  camCapCents?: number;
  fixedPercentage?: number;
  baseYearAmountCents?: number;
  excludedCategories?: string[];
}

export type AllocationMethod = 'pro_rata' | 'fixed_percentage' | 'base_year_stop' | 'modified_gross';

export interface WhatIfOptions {
  allocationMethod: AllocationMethod;
  grossUpEnabled: boolean;
  targetOccupancy: number;
  exclusions: string[];
}

export interface WhatIfInput {
  propertyId: string;
  totalLeasableArea: number;
  periodStart: string;
  periodEnd: string;
  lineItems: WhatIfLineItem[];
  tenants: WhatIfTenant[];
  options: WhatIfOptions;
}

export interface WhatIfAllocation {
  tenantId: string;
  squareFootage: number;
  sharePercentage: number;
  estimatedAmountCents: number;
  actualAmountCents: number;
  varianceCents: number;
}

export interface WhatIfResult {
  totalExpensesCents: number;
  allocations: WhatIfAllocation[];
  isBalanced: boolean;
  appliedMethod: AllocationMethod;
  grossUpApplied: boolean;
  originalTotalExpensesCents: number;
  excludedCategories: string[];
}

export function useWhatIfSimulation() {
  return useMutation({
    mutationFn: async (input: WhatIfInput) => {
      const response = await api.post<{ data: WhatIfResult }>('/api/reconciliations/what-if', input);
      return response.data;
    },
  });
}

export function useExplainVariance() {
  return useMutation({
    mutationFn: async (reconciliationId: string) => {
      const response = await api.post<{ data: { tenantId: string; explanation: string; variancePercentage: number }[] }>(
        `/api/reconciliations/${reconciliationId}/explain`
      );
      return response.data;
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ActivityEntry } from './useProperties';

export interface Tenant {
  id: string;
  name: string;
  contactEmail: string;
  propertyId: string;
  propertyName?: string;
  suiteNumber: string;
  squareFootage: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaseInfo {
  id: string;
  documentId: string;
  commencementDate: string;
  expirationDate: string;
  baseRentCents: number;
  rentEscalation: { type: string; rate: number } | null;
  camCapCents: number | null;
  securityDepositCents: number | null;
  confidenceScore: number;
  reviewStatus: string;
}

export interface TenantDetail extends Tenant {
  lease: LeaseInfo | null;
  documents: TenantDocument[];
}

export interface TenantDocument {
  id: string;
  title: string;
  documentType: string;
  currentVersion: number;
  createdAt: string;
}

export function useTenants(propertyId?: string) {
  return useQuery<Tenant[]>({
    queryKey: ['tenants', { propertyId }],
    queryFn: async () => {
      const params = propertyId ? `?propertyId=${propertyId}` : '';
      const response = await api.get<{ data: Tenant[] }>(`/api/tenants${params}`);
      return response.data;
    },
  });
}

export function useTenant(tenantId: string) {
  return useQuery<TenantDetail>({
    queryKey: ['tenants', tenantId],
    queryFn: async () => {
      const response = await api.get<{ data: TenantDetail }>(`/api/tenants/${tenantId}`);
      return response.data;
    },
    enabled: !!tenantId,
  });
}

export function useTenantActivity(tenantId: string) {
  return useQuery<ActivityEntry[]>({
    queryKey: ['activity', 'tenant', tenantId],
    queryFn: async () => {
      const response = await api.get<{ data: ActivityEntry[] }>(`/api/activity/tenant/${tenantId}`);
      return response.data;
    },
    enabled: !!tenantId,
  });
}

export interface CreateTenantInput {
  name: string;
  contactEmail: string;
  propertyId: string;
  suiteNumber: string;
  squareFootage: number;
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTenantInput) => {
      const response = await api.post<{ data: Tenant }>('/api/tenants', input);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties', variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

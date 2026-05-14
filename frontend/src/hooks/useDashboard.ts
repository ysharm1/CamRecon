import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PortfolioMetrics {
  totalProperties: number;
  totalTenants: number;
  occupancyRate: number;
  totalLeasableArea: number;
}

export interface LeaseExpirationItem {
  id: string;
  tenantId: string;
  tenantName: string;
  propertyName: string;
  expirationDate: string;
  daysUntilExpiration: number;
}

export interface LeaseExpirations {
  within30Days: number;
  within60Days: number;
  within90Days: number;
  items: LeaseExpirationItem[];
}

export interface PendingReconciliation {
  id: string;
  propertyId: string;
  propertyName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
}

export interface OverdueDocument {
  id: string;
  documentId: string;
  tenantName: string;
  propertyName: string;
  reviewStatus: string;
  createdAt: string;
}

export interface DashboardData {
  metrics: PortfolioMetrics;
  leaseExpirations: LeaseExpirations;
  pendingReconciliations: PendingReconciliation[];
  overdueDocuments: OverdueDocument[];
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get<{ data: DashboardData }>('/api/dashboard');
      return response.data;
    },
  });
}

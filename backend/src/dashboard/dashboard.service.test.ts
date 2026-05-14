import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../db', () => {
  const mockDb = vi.fn();
  (mockDb as any).raw = vi.fn();
  return { default: mockDb };
});

import db from '../db';
import {
  getPortfolioMetrics,
  getLeaseExpirations,
  getPendingReconciliations,
  getOverdueDocuments,
  getDashboardData,
} from './dashboard.service';

// Helper to create chainable query builder mock
function createQueryBuilder(result: any = []) {
  const builder: any = {};
  builder.where = vi.fn().mockReturnValue(builder);
  builder.whereIn = vi.fn().mockReturnValue(builder);
  builder.whereNotIn = vi.fn().mockReturnValue(builder);
  builder.join = vi.fn().mockReturnValue(builder);
  builder.orderBy = vi.fn().mockReturnValue(builder);
  builder.select = vi.fn().mockReturnValue(builder);
  builder.pluck = vi.fn().mockResolvedValue(result);
  // Make the builder thenable so await resolves to result
  builder.then = (resolve: any) => resolve(result);
  return builder;
}

describe('Dashboard Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPortfolioMetrics', () => {
    it('should return zero metrics when no properties exist', async () => {
      const propertiesBuilder = createQueryBuilder([]);
      vi.mocked(db).mockReturnValue(propertiesBuilder);

      const result = await getPortfolioMetrics('org-123');

      expect(result).toEqual({
        totalProperties: 0,
        totalTenants: 0,
        occupancyRate: 0,
        totalLeasableArea: 0,
      });
    });

    it('should calculate metrics correctly with properties and tenants', async () => {
      const properties = [
        { id: 'prop-1', total_square_footage: 50000 },
        { id: 'prop-2', total_square_footage: 30000 },
      ];
      const tenants = [
        { square_footage: 20000 },
        { square_footage: 15000 },
        { square_footage: 10000 },
      ];

      let callCount = 0;
      vi.mocked(db).mockImplementation((() => {
        callCount++;
        if (callCount === 1) {
          // properties query
          return createQueryBuilder(properties);
        }
        // tenants query
        return createQueryBuilder(tenants);
      }) as any);

      const result = await getPortfolioMetrics('org-123');

      expect(result.totalProperties).toBe(2);
      expect(result.totalTenants).toBe(3);
      expect(result.totalLeasableArea).toBe(80000);
      // occupancy = 45000 / 80000 = 0.5625
      expect(result.occupancyRate).toBe(0.5625);
    });

    it('should handle zero total leasable area gracefully', async () => {
      const properties = [{ id: 'prop-1', total_square_footage: 0 }];
      const tenants: any[] = [];

      let callCount = 0;
      vi.mocked(db).mockImplementation((() => {
        callCount++;
        if (callCount === 1) return createQueryBuilder(properties);
        return createQueryBuilder(tenants);
      }) as any);

      const result = await getPortfolioMetrics('org-123');

      expect(result.occupancyRate).toBe(0);
    });
  });

  describe('getLeaseExpirations', () => {
    it('should return empty results when no properties exist', async () => {
      const builder = createQueryBuilder([]);
      vi.mocked(db).mockReturnValue(builder);

      const result = await getLeaseExpirations('org-123');

      expect(result).toEqual({
        within30Days: 0,
        within60Days: 0,
        within90Days: 0,
        items: [],
      });
    });

    it('should categorize expirations into 30/60/90 day buckets', async () => {
      const now = new Date();
      const in15Days = new Date(now);
      in15Days.setDate(in15Days.getDate() + 15);
      const in45Days = new Date(now);
      in45Days.setDate(in45Days.getDate() + 45);
      const in75Days = new Date(now);
      in75Days.setDate(in75Days.getDate() + 75);

      const expiringLeases = [
        {
          id: 'la-1',
          tenant_id: 'tenant-1',
          expiration_date: in15Days.toISOString().split('T')[0],
          tenant_name: 'Tenant A',
          property_name: 'Property 1',
        },
        {
          id: 'la-2',
          tenant_id: 'tenant-2',
          expiration_date: in45Days.toISOString().split('T')[0],
          tenant_name: 'Tenant B',
          property_name: 'Property 2',
        },
        {
          id: 'la-3',
          tenant_id: 'tenant-3',
          expiration_date: in75Days.toISOString().split('T')[0],
          tenant_name: 'Tenant C',
          property_name: 'Property 1',
        },
      ];

      let callCount = 0;
      vi.mocked(db).mockImplementation((() => {
        callCount++;
        if (callCount === 1) {
          // pluck property IDs
          return createQueryBuilder(['prop-1', 'prop-2']);
        }
        // lease abstractions query
        return createQueryBuilder(expiringLeases);
      }) as any);

      const result = await getLeaseExpirations('org-123');

      expect(result.within30Days).toBe(1);
      expect(result.within60Days).toBe(2);
      expect(result.within90Days).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.items[0].tenantName).toBe('Tenant A');
      expect(result.items[0].daysUntilExpiration).toBeLessThanOrEqual(30);
    });
  });

  describe('getPendingReconciliations', () => {
    it('should return empty array when no properties exist', async () => {
      const builder = createQueryBuilder([]);
      vi.mocked(db).mockReturnValue(builder);

      const result = await getPendingReconciliations('org-123');

      expect(result).toEqual([]);
    });

    it('should return pending reconciliations with property names', async () => {
      const reconciliations = [
        {
          id: 'recon-1',
          property_id: 'prop-1',
          property_name: 'Downtown Office',
          period_start: '2024-01-01',
          period_end: '2024-03-31',
          status: 'draft',
          created_at: '2024-01-10T10:00:00Z',
        },
        {
          id: 'recon-2',
          property_id: 'prop-2',
          property_name: 'Retail Plaza',
          period_start: '2024-01-01',
          period_end: '2024-06-30',
          status: 'in_progress',
          created_at: '2024-01-12T10:00:00Z',
        },
      ];

      let callCount = 0;
      vi.mocked(db).mockImplementation((() => {
        callCount++;
        if (callCount === 1) {
          return createQueryBuilder(['prop-1', 'prop-2']);
        }
        return createQueryBuilder(reconciliations);
      }) as any);

      const result = await getPendingReconciliations('org-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('recon-1');
      expect(result[0].propertyName).toBe('Downtown Office');
      expect(result[0].status).toBe('draft');
      expect(result[1].status).toBe('in_progress');
    });
  });

  describe('getOverdueDocuments', () => {
    it('should return empty array when no properties exist', async () => {
      const builder = createQueryBuilder([]);
      vi.mocked(db).mockReturnValue(builder);

      const result = await getOverdueDocuments('org-123');

      expect(result).toEqual([]);
    });

    it('should return overdue documents with tenant and property names', async () => {
      const overdueAbstractions = [
        {
          id: 'la-1',
          document_id: 'doc-1',
          tenant_name: 'Acme Corp',
          property_name: 'Downtown Office',
          review_status: 'pending',
          created_at: '2024-01-05T08:00:00Z',
        },
      ];

      let callCount = 0;
      vi.mocked(db).mockImplementation((() => {
        callCount++;
        if (callCount === 1) {
          return createQueryBuilder(['prop-1']);
        }
        return createQueryBuilder(overdueAbstractions);
      }) as any);

      const result = await getOverdueDocuments('org-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('la-1');
      expect(result[0].documentId).toBe('doc-1');
      expect(result[0].tenantName).toBe('Acme Corp');
      expect(result[0].propertyName).toBe('Downtown Office');
      expect(result[0].reviewStatus).toBe('pending');
    });
  });

  describe('getDashboardData', () => {
    it('should aggregate all dashboard data in a single call', async () => {
      // Mock all queries to return empty results for simplicity
      vi.mocked(db).mockImplementation((() => {
        return createQueryBuilder([]);
      }) as any);

      const result = await getDashboardData('org-123');

      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('leaseExpirations');
      expect(result).toHaveProperty('pendingReconciliations');
      expect(result).toHaveProperty('overdueDocuments');
    });
  });
});

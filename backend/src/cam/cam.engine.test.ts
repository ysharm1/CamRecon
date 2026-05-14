import { describe, it, expect } from 'vitest';
import {
  calculateProRataShare,
  sumLineItems,
  applyCAMCap,
  calculateTenantAllocation,
  reconcile,
} from './cam.engine';
import type {
  TenantLease,
  CAMLineItem,
  ReconciliationConfig,
} from './cam.types';

describe('CAM Engine', () => {
  describe('calculateProRataShare', () => {
    it('returns correct share for a tenant', () => {
      // 2000 sqft out of 10000 total = 0.2
      expect(calculateProRataShare(2000, 10000)).toBe(0.2);
    });

    it('returns 0 when totalSqFt is 0', () => {
      expect(calculateProRataShare(1000, 0)).toBe(0);
    });

    it('returns 1 when tenant occupies entire space', () => {
      expect(calculateProRataShare(5000, 5000)).toBe(1);
    });

    it('returns value between 0 and 1 for partial occupancy', () => {
      const share = calculateProRataShare(3000, 10000);
      expect(share).toBeGreaterThan(0);
      expect(share).toBeLessThan(1);
      expect(share).toBeCloseTo(0.3);
    });
  });

  describe('sumLineItems', () => {
    it('sums all line item amounts in cents', () => {
      const items: CAMLineItem[] = [
        { category: 'Maintenance', description: 'Landscaping', amountCents: 150000 },
        { category: 'Utilities', description: 'Water', amountCents: 80000 },
        { category: 'Insurance', description: 'Property insurance', amountCents: 50000 },
      ];
      expect(sumLineItems(items)).toBe(280000);
    });

    it('returns 0 for empty list', () => {
      expect(sumLineItems([])).toBe(0);
    });

    it('handles a single item', () => {
      const items: CAMLineItem[] = [
        { category: 'Maintenance', description: 'Cleaning', amountCents: 100000 },
      ];
      expect(sumLineItems(items)).toBe(100000);
    });
  });

  describe('applyCAMCap', () => {
    it('returns actual when no cap is provided', () => {
      expect(applyCAMCap(50000)).toBe(50000);
    });

    it('returns actual when cap is undefined', () => {
      expect(applyCAMCap(50000, undefined)).toBe(50000);
    });

    it('returns actual when actual is below cap', () => {
      expect(applyCAMCap(30000, 50000)).toBe(30000);
    });

    it('returns cap when actual exceeds cap', () => {
      expect(applyCAMCap(70000, 50000)).toBe(50000);
    });

    it('returns actual when actual equals cap', () => {
      expect(applyCAMCap(50000, 50000)).toBe(50000);
    });
  });

  describe('calculateTenantAllocation', () => {
    it('calculates allocation without cap', () => {
      const tenant: TenantLease = {
        tenantId: 'tenant-1',
        squareFootage: 2000,
        estimatedCAMCents: 40000,
      };
      const totalExpensesCents = 200000;
      const totalSqFt = 10000;

      const result = calculateTenantAllocation(tenant, totalExpensesCents, totalSqFt);

      expect(result.tenantId).toBe('tenant-1');
      expect(result.squareFootage).toBe(2000);
      expect(result.sharePercentage).toBe(0.2);
      expect(result.actualAmountCents).toBe(40000); // 0.2 * 200000
      expect(result.estimatedAmountCents).toBe(40000);
      expect(result.varianceCents).toBe(0); // 40000 - 40000
    });

    it('applies cap when allocation exceeds cap', () => {
      const tenant: TenantLease = {
        tenantId: 'tenant-2',
        squareFootage: 5000,
        camCapCents: 80000,
        estimatedCAMCents: 70000,
      };
      const totalExpensesCents = 200000;
      const totalSqFt = 10000;

      const result = calculateTenantAllocation(tenant, totalExpensesCents, totalSqFt);

      // Raw allocation = 0.5 * 200000 = 100000, but cap is 80000
      expect(result.sharePercentage).toBe(0.5);
      expect(result.actualAmountCents).toBe(80000);
      expect(result.varianceCents).toBe(10000); // 80000 - 70000
    });

    it('does not apply cap when allocation is below cap', () => {
      const tenant: TenantLease = {
        tenantId: 'tenant-3',
        squareFootage: 1000,
        camCapCents: 50000,
        estimatedCAMCents: 15000,
      };
      const totalExpensesCents = 200000;
      const totalSqFt = 10000;

      const result = calculateTenantAllocation(tenant, totalExpensesCents, totalSqFt);

      // Raw allocation = 0.1 * 200000 = 20000, cap is 50000 (not hit)
      expect(result.actualAmountCents).toBe(20000);
      expect(result.varianceCents).toBe(5000); // 20000 - 15000
    });

    it('calculates negative variance when estimated exceeds actual', () => {
      const tenant: TenantLease = {
        tenantId: 'tenant-4',
        squareFootage: 1000,
        estimatedCAMCents: 30000,
      };
      const totalExpensesCents = 200000;
      const totalSqFt = 10000;

      const result = calculateTenantAllocation(tenant, totalExpensesCents, totalSqFt);

      // Raw allocation = 0.1 * 200000 = 20000
      expect(result.actualAmountCents).toBe(20000);
      expect(result.varianceCents).toBe(-10000); // 20000 - 30000
    });
  });

  describe('reconcile', () => {
    const config: ReconciliationConfig = {
      propertyId: 'property-1',
      totalLeasableArea: 10000,
      periodStart: '2024-01-01',
      periodEnd: '2024-12-31',
    };

    const lineItems: CAMLineItem[] = [
      { category: 'Maintenance', description: 'Landscaping', amountCents: 100000 },
      { category: 'Utilities', description: 'Water', amountCents: 60000 },
      { category: 'Insurance', description: 'Property', amountCents: 40000 },
    ];

    it('computes total expenses from line items', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 100000 },
        { tenantId: 't2', squareFootage: 5000, estimatedCAMCents: 100000 },
      ];

      const result = reconcile(config, lineItems, tenants);
      expect(result.totalExpensesCents).toBe(200000);
    });

    it('is balanced when tenants cover full area without caps', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 100000 },
        { tenantId: 't2', squareFootage: 5000, estimatedCAMCents: 100000 },
      ];

      const result = reconcile(config, lineItems, tenants);

      expect(result.isBalanced).toBe(true);
      expect(result.allocations).toHaveLength(2);
      expect(result.allocations[0].actualAmountCents).toBe(100000);
      expect(result.allocations[1].actualAmountCents).toBe(100000);
    });

    it('is not balanced when caps reduce allocations', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, camCapCents: 80000, estimatedCAMCents: 80000 },
        { tenantId: 't2', squareFootage: 5000, estimatedCAMCents: 100000 },
      ];

      const result = reconcile(config, lineItems, tenants);

      // t1: raw = 100000, capped to 80000
      // t2: raw = 100000, no cap
      // total allocated = 180000, total expenses = 200000
      expect(result.isBalanced).toBe(false);
      expect(result.allocations[0].actualAmountCents).toBe(80000);
      expect(result.allocations[1].actualAmountCents).toBe(100000);
    });

    it('is not balanced when tenants do not cover full area', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 3000, estimatedCAMCents: 60000 },
        { tenantId: 't2', squareFootage: 4000, estimatedCAMCents: 80000 },
      ];

      const result = reconcile(config, lineItems, tenants);

      // t1: 0.3 * 200000 = 60000
      // t2: 0.4 * 200000 = 80000
      // total allocated = 140000, total expenses = 200000
      expect(result.isBalanced).toBe(false);
      expect(result.allocations[0].actualAmountCents).toBe(60000);
      expect(result.allocations[1].actualAmountCents).toBe(80000);
    });

    it('handles empty tenants list', () => {
      const result = reconcile(config, lineItems, []);

      expect(result.totalExpensesCents).toBe(200000);
      expect(result.allocations).toHaveLength(0);
      expect(result.isBalanced).toBe(false);
    });

    it('handles empty line items', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 0 },
      ];

      const result = reconcile(config, [], tenants);

      expect(result.totalExpensesCents).toBe(0);
      expect(result.allocations[0].actualAmountCents).toBe(0);
      expect(result.isBalanced).toBe(true);
    });

    it('calculates correct variance for each tenant', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 6000, estimatedCAMCents: 100000 },
        { tenantId: 't2', squareFootage: 4000, estimatedCAMCents: 90000 },
      ];

      const result = reconcile(config, lineItems, tenants);

      // t1: 0.6 * 200000 = 120000, variance = 120000 - 100000 = 20000
      // t2: 0.4 * 200000 = 80000, variance = 80000 - 90000 = -10000
      expect(result.allocations[0].varianceCents).toBe(20000);
      expect(result.allocations[1].varianceCents).toBe(-10000);
    });
  });
});

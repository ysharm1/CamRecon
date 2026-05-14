import { describe, it, expect } from 'vitest';
import {
  grossUpExpenses,
  applyExclusions,
  reconcileWithMethod,
  whatIfReconcile,
} from './cam.engine';
import type {
  TenantLease,
  CAMLineItem,
  ReconciliationConfig,
  WhatIfOptions,
} from './cam.types';

describe('CAM Engine - Advanced Allocation Methods & What-If', () => {
  const config: ReconciliationConfig = {
    propertyId: 'property-1',
    totalLeasableArea: 10000,
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
  };

  const lineItems: CAMLineItem[] = [
    { category: 'Maintenance', description: 'General', amountCents: 100000 },
    { category: 'Insurance', description: 'Property', amountCents: 60000 },
    { category: 'Capital Improvements', description: 'Roof repair', amountCents: 40000 },
  ];

  describe('grossUpExpenses', () => {
    it('returns same amount when occupancy >= target', () => {
      expect(grossUpExpenses(100000, 0.95, 0.95)).toBe(100000);
      expect(grossUpExpenses(100000, 1.0, 0.95)).toBe(100000);
    });

    it('adjusts expenses upward when occupancy < target', () => {
      // 100000 / 0.80 * 0.95 = 118750
      const result = grossUpExpenses(100000, 0.80, 0.95);
      expect(result).toBe(118750);
    });

    it('returns same amount when occupancy is 0', () => {
      expect(grossUpExpenses(100000, 0, 0.95)).toBe(100000);
    });

    it('uses default target of 0.95', () => {
      const result = grossUpExpenses(100000, 0.80);
      expect(result).toBe(118750);
    });
  });

  describe('applyExclusions', () => {
    it('returns all items when no exclusions', () => {
      const result = applyExclusions(lineItems, []);
      expect(result).toHaveLength(3);
    });

    it('filters out excluded categories (case-insensitive)', () => {
      const result = applyExclusions(lineItems, ['capital improvements']);
      expect(result).toHaveLength(2);
      expect(result.find((i) => i.category === 'Capital Improvements')).toBeUndefined();
    });

    it('handles multiple exclusions', () => {
      const result = applyExclusions(lineItems, ['Capital Improvements', 'Insurance']);
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Maintenance');
    });

    it('handles exclusions that do not match any items', () => {
      const result = applyExclusions(lineItems, ['Nonexistent']);
      expect(result).toHaveLength(3);
    });
  });

  describe('reconcileWithMethod - fixed_percentage', () => {
    it('uses fixedPercentage when provided', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 3000, estimatedCAMCents: 0, fixedPercentage: 0.60 },
        { tenantId: 't2', squareFootage: 7000, estimatedCAMCents: 0, fixedPercentage: 0.40 },
      ];

      const result = reconcileWithMethod(config, lineItems, tenants, 'fixed_percentage');

      // Total = 200000
      expect(result.allocations[0].sharePercentage).toBe(0.60);
      expect(result.allocations[0].actualAmountCents).toBe(120000); // 0.60 * 200000
      expect(result.allocations[1].sharePercentage).toBe(0.40);
      expect(result.allocations[1].actualAmountCents).toBe(80000); // 0.40 * 200000
    });

    it('falls back to pro-rata when fixedPercentage is not set', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 0 },
      ];

      const result = reconcileWithMethod(config, lineItems, tenants, 'fixed_percentage');
      expect(result.allocations[0].sharePercentage).toBe(0.5);
    });
  });

  describe('reconcileWithMethod - base_year_stop', () => {
    it('tenant pays only excess above base year', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 50000, baseYearAmountCents: 80000 },
      ];

      const result = reconcileWithMethod(config, lineItems, tenants, 'base_year_stop');

      // Pro-rata share = 0.5, raw = 100000, base year = 80000, excess = 20000
      expect(result.allocations[0].actualAmountCents).toBe(20000);
    });

    it('tenant pays nothing when expenses are below base year', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 50000, baseYearAmountCents: 150000 },
      ];

      const result = reconcileWithMethod(config, lineItems, tenants, 'base_year_stop');

      // Pro-rata share = 0.5, raw = 100000, base year = 150000, excess = 0
      expect(result.allocations[0].actualAmountCents).toBe(0);
    });
  });

  describe('reconcileWithMethod - modified_gross', () => {
    it('tenant pays only increase above base year', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 0, baseYearAmountCents: 70000 },
      ];

      const result = reconcileWithMethod(config, lineItems, tenants, 'modified_gross');

      // Pro-rata share = 0.5, raw = 100000, base = 70000, increase = 30000
      expect(result.allocations[0].actualAmountCents).toBe(30000);
    });

    it('tenant pays nothing when no increase above base', () => {
      const tenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 0, baseYearAmountCents: 120000 },
      ];

      const result = reconcileWithMethod(config, lineItems, tenants, 'modified_gross');

      // Pro-rata share = 0.5, raw = 100000, base = 120000, increase = 0
      expect(result.allocations[0].actualAmountCents).toBe(0);
    });
  });

  describe('whatIfReconcile', () => {
    const tenants: TenantLease[] = [
      { tenantId: 't1', squareFootage: 4000, estimatedCAMCents: 80000 },
      { tenantId: 't2', squareFootage: 3000, estimatedCAMCents: 60000 },
    ];

    it('runs basic pro-rata simulation without gross-up or exclusions', () => {
      const options: WhatIfOptions = {
        allocationMethod: 'pro_rata',
        grossUpEnabled: false,
        targetOccupancy: 0.95,
        exclusions: [],
      };

      const result = whatIfReconcile(config, lineItems, tenants, options);

      expect(result.appliedMethod).toBe('pro_rata');
      expect(result.grossUpApplied).toBe(false);
      expect(result.totalExpensesCents).toBe(200000);
      expect(result.originalTotalExpensesCents).toBe(200000);
      expect(result.excludedCategories).toEqual([]);
      expect(result.allocations).toHaveLength(2);
    });

    it('applies exclusions and reduces total expenses', () => {
      const options: WhatIfOptions = {
        allocationMethod: 'pro_rata',
        grossUpEnabled: false,
        targetOccupancy: 0.95,
        exclusions: ['Capital Improvements'],
      };

      const result = whatIfReconcile(config, lineItems, tenants, options);

      // Total after exclusion: 100000 + 60000 = 160000
      expect(result.totalExpensesCents).toBe(160000);
      expect(result.originalTotalExpensesCents).toBe(200000);
      expect(result.excludedCategories).toEqual(['Capital Improvements']);
    });

    it('applies gross-up when occupancy is below target', () => {
      const options: WhatIfOptions = {
        allocationMethod: 'pro_rata',
        grossUpEnabled: true,
        targetOccupancy: 0.95,
        exclusions: [],
      };

      const result = whatIfReconcile(config, lineItems, tenants, options);

      // Current occupancy = (4000 + 3000) / 10000 = 0.70
      // Gross-up: 200000 / 0.70 * 0.95 = 271429 (rounded)
      expect(result.grossUpApplied).toBe(true);
      expect(result.totalExpensesCents).toBe(271429);
    });

    it('does not apply gross-up when occupancy >= target', () => {
      const fullTenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 5000, estimatedCAMCents: 100000 },
        { tenantId: 't2', squareFootage: 5000, estimatedCAMCents: 100000 },
      ];

      const options: WhatIfOptions = {
        allocationMethod: 'pro_rata',
        grossUpEnabled: true,
        targetOccupancy: 0.95,
        exclusions: [],
      };

      const result = whatIfReconcile(config, lineItems, fullTenants, options);

      // Occupancy = 10000/10000 = 1.0 >= 0.95, no gross-up
      expect(result.grossUpApplied).toBe(false);
      expect(result.totalExpensesCents).toBe(200000);
    });

    it('combines exclusions and gross-up', () => {
      const options: WhatIfOptions = {
        allocationMethod: 'pro_rata',
        grossUpEnabled: true,
        targetOccupancy: 0.95,
        exclusions: ['Capital Improvements'],
      };

      const result = whatIfReconcile(config, lineItems, tenants, options);

      // After exclusion: 160000
      // Occupancy = 7000/10000 = 0.70
      // Gross-up: 160000 / 0.70 * 0.95 = 217143 (rounded)
      expect(result.excludedCategories).toEqual(['Capital Improvements']);
      expect(result.grossUpApplied).toBe(true);
      expect(result.totalExpensesCents).toBe(217143);
    });

    it('uses fixed_percentage method in what-if', () => {
      const fixedTenants: TenantLease[] = [
        { tenantId: 't1', squareFootage: 4000, estimatedCAMCents: 80000, fixedPercentage: 0.55 },
        { tenantId: 't2', squareFootage: 3000, estimatedCAMCents: 60000, fixedPercentage: 0.45 },
      ];

      const options: WhatIfOptions = {
        allocationMethod: 'fixed_percentage',
        grossUpEnabled: false,
        targetOccupancy: 0.95,
        exclusions: [],
      };

      const result = whatIfReconcile(config, lineItems, fixedTenants, options);

      expect(result.appliedMethod).toBe('fixed_percentage');
      expect(result.allocations[0].sharePercentage).toBe(0.55);
      expect(result.allocations[0].actualAmountCents).toBe(110000);
      expect(result.allocations[1].sharePercentage).toBe(0.45);
      expect(result.allocations[1].actualAmountCents).toBe(90000);
    });
  });
});

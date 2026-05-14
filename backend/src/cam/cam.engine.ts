/**
 * CAM Engine — Pure calculation functions for CAM reconciliation.
 *
 * No database access; all inputs and outputs are plain data.
 * All monetary values are integer cents.
 */

import type {
  TenantLease,
  CAMLineItem,
  ReconciliationConfig,
  TenantAllocation,
  ReconciliationResult,
  AllocationMethod,
  WhatIfOptions,
  WhatIfResult,
} from './cam.types';

/**
 * Calculate pro-rata share percentage based on square footage.
 * Returns a number in the range [0, 1].
 * Returns 0 if totalSqFt is 0 to avoid division by zero.
 */
export function calculateProRataShare(tenantSqFt: number, totalSqFt: number): number {
  if (totalSqFt === 0) return 0;
  return tenantSqFt / totalSqFt;
}

/**
 * Sum all line item amounts (in cents).
 */
export function sumLineItems(items: CAMLineItem[]): number {
  return items.reduce((acc, item) => acc + item.amountCents, 0);
}

/**
 * Apply CAM cap if one exists.
 * Returns the lesser of actualCents and capCents when a cap is provided.
 */
export function applyCAMCap(actualCents: number, capCents?: number): number {
  if (capCents === undefined || capCents === null) return actualCents;
  return Math.min(actualCents, capCents);
}

/**
 * Gross-up expenses to a target occupancy baseline.
 * Adjusts variable expenses as if the building were at target occupancy.
 *
 * Formula: adjustedExpenses = totalExpenses / currentOccupancy * targetOccupancy
 * If currentOccupancy >= targetOccupancy, no adjustment is made.
 */
export function grossUpExpenses(
  totalExpensesCents: number,
  occupancyRate: number,
  targetOccupancy: number = 0.95
): number {
  if (occupancyRate <= 0) return totalExpensesCents;
  if (occupancyRate >= targetOccupancy) return totalExpensesCents;
  return Math.round((totalExpensesCents / occupancyRate) * targetOccupancy);
}

/**
 * Filter out excluded categories from line items.
 * Returns a new array with only non-excluded items.
 */
export function applyExclusions(
  lineItems: CAMLineItem[],
  exclusions: string[]
): CAMLineItem[] {
  if (!exclusions || exclusions.length === 0) return lineItems;
  const excludedSet = new Set(exclusions.map((e) => e.toLowerCase()));
  return lineItems.filter((item) => !excludedSet.has(item.category.toLowerCase()));
}

/**
 * Calculate a single tenant's CAM allocation.
 *
 * Algorithm:
 *   1. sharePercentage = tenantSqFt / totalSqFt
 *   2. rawAllocation = Math.round(sharePercentage * totalExpensesCents)
 *   3. cappedAllocation = min(rawAllocation, camCapCents) if cap exists
 *   4. variance = cappedAllocation - estimatedCAMCents
 */
export function calculateTenantAllocation(
  tenant: TenantLease,
  totalExpensesCents: number,
  totalSqFt: number
): TenantAllocation {
  const sharePercentage = calculateProRataShare(tenant.squareFootage, totalSqFt);
  const rawAllocation = Math.round(sharePercentage * totalExpensesCents);
  const actualAmountCents = applyCAMCap(rawAllocation, tenant.camCapCents);
  const varianceCents = actualAmountCents - tenant.estimatedCAMCents;

  return {
    tenantId: tenant.tenantId,
    squareFootage: tenant.squareFootage,
    sharePercentage,
    estimatedAmountCents: tenant.estimatedCAMCents,
    actualAmountCents,
    varianceCents,
  };
}

/**
 * Calculate allocation using a specific method.
 *
 * Methods:
 * - pro_rata: Standard square footage proportional allocation
 * - fixed_percentage: Uses tenant.fixedPercentage directly
 * - base_year_stop: Tenant pays only expenses above their base year amount
 * - modified_gross: Landlord absorbs first portion, tenant pays pro-rata of excess
 */
export function reconcileWithMethod(
  config: ReconciliationConfig,
  lineItems: CAMLineItem[],
  tenants: TenantLease[],
  method: AllocationMethod
): ReconciliationResult {
  const totalExpensesCents = sumLineItems(lineItems);

  let allocations: TenantAllocation[];

  switch (method) {
    case 'pro_rata':
      allocations = tenants.map((tenant) =>
        calculateTenantAllocation(tenant, totalExpensesCents, config.totalLeasableArea)
      );
      break;

    case 'fixed_percentage':
      allocations = tenants.map((tenant) => {
        const sharePercentage = tenant.fixedPercentage ?? calculateProRataShare(tenant.squareFootage, config.totalLeasableArea);
        const rawAllocation = Math.round(sharePercentage * totalExpensesCents);
        const actualAmountCents = applyCAMCap(rawAllocation, tenant.camCapCents);
        const varianceCents = actualAmountCents - tenant.estimatedCAMCents;
        return {
          tenantId: tenant.tenantId,
          squareFootage: tenant.squareFootage,
          sharePercentage,
          estimatedAmountCents: tenant.estimatedCAMCents,
          actualAmountCents,
          varianceCents,
        };
      });
      break;

    case 'base_year_stop':
      allocations = tenants.map((tenant) => {
        const sharePercentage = calculateProRataShare(tenant.squareFootage, config.totalLeasableArea);
        const rawAllocation = Math.round(sharePercentage * totalExpensesCents);
        const baseYearAmount = tenant.baseYearAmountCents ?? 0;
        // Tenant only pays the amount exceeding their base year
        const excessAmount = Math.max(0, rawAllocation - baseYearAmount);
        const actualAmountCents = applyCAMCap(excessAmount, tenant.camCapCents);
        const varianceCents = actualAmountCents - tenant.estimatedCAMCents;
        return {
          tenantId: tenant.tenantId,
          squareFootage: tenant.squareFootage,
          sharePercentage,
          estimatedAmountCents: tenant.estimatedCAMCents,
          actualAmountCents,
          varianceCents,
        };
      });
      break;

    case 'modified_gross':
      // In modified gross, landlord absorbs base amount (first year's expenses pro-rata)
      // Tenant pays pro-rata share of increases above base
      allocations = tenants.map((tenant) => {
        const sharePercentage = calculateProRataShare(tenant.squareFootage, config.totalLeasableArea);
        const rawAllocation = Math.round(sharePercentage * totalExpensesCents);
        const baseYearAmount = tenant.baseYearAmountCents ?? rawAllocation;
        // Tenant pays only the increase above base year
        const increaseAmount = Math.max(0, rawAllocation - baseYearAmount);
        const actualAmountCents = applyCAMCap(increaseAmount, tenant.camCapCents);
        const varianceCents = actualAmountCents - tenant.estimatedCAMCents;
        return {
          tenantId: tenant.tenantId,
          squareFootage: tenant.squareFootage,
          sharePercentage,
          estimatedAmountCents: tenant.estimatedCAMCents,
          actualAmountCents,
          varianceCents,
        };
      });
      break;

    default:
      allocations = tenants.map((tenant) =>
        calculateTenantAllocation(tenant, totalExpensesCents, config.totalLeasableArea)
      );
  }

  const allocatedTotal = allocations.reduce((acc, a) => acc + a.actualAmountCents, 0);
  const isBalanced = allocatedTotal === totalExpensesCents;

  return {
    totalExpensesCents,
    allocations,
    isBalanced,
  };
}

/**
 * Perform a what-if reconciliation simulation.
 * Same as reconcile but applies optional gross-up, exclusions, and allocation method.
 * Never persists results — purely computational.
 */
export function whatIfReconcile(
  config: ReconciliationConfig,
  lineItems: CAMLineItem[],
  tenants: TenantLease[],
  options: WhatIfOptions
): WhatIfResult {
  const { allocationMethod, grossUpEnabled, targetOccupancy, exclusions } = options;

  // 1. Apply exclusions
  const filteredLineItems = applyExclusions(lineItems, exclusions);
  const originalTotalExpensesCents = sumLineItems(lineItems);

  // 2. Calculate total expenses after exclusions
  let totalExpensesCents = sumLineItems(filteredLineItems);

  // 3. Apply gross-up if enabled
  let grossUpApplied = false;
  if (grossUpEnabled && config.totalLeasableArea > 0) {
    const totalTenantSqFt = tenants.reduce((sum, t) => sum + t.squareFootage, 0);
    const currentOccupancy = totalTenantSqFt / config.totalLeasableArea;
    const adjustedExpenses = grossUpExpenses(totalExpensesCents, currentOccupancy, targetOccupancy);
    if (adjustedExpenses !== totalExpensesCents) {
      grossUpApplied = true;
      totalExpensesCents = adjustedExpenses;
    }
  }

  // 4. Create adjusted line items for the engine (proportionally scaled if gross-up applied)
  const adjustedLineItems: CAMLineItem[] = grossUpApplied
    ? [{ category: 'Adjusted Total', description: 'Gross-up adjusted expenses', amountCents: totalExpensesCents }]
    : filteredLineItems;

  // 5. Reconcile with the specified method
  const result = reconcileWithMethod(config, adjustedLineItems, tenants, allocationMethod);

  return {
    ...result,
    appliedMethod: allocationMethod,
    grossUpApplied,
    originalTotalExpensesCents,
    excludedCategories: exclusions,
  };
}

/**
 * Perform full CAM reconciliation for a property.
 *
 * Aggregates expenses from line items, computes each tenant's allocation,
 * and determines whether the reconciliation is balanced (sum of allocations
 * equals total expenses — may not balance when caps apply).
 */
export function reconcile(
  config: ReconciliationConfig,
  lineItems: CAMLineItem[],
  tenants: TenantLease[]
): ReconciliationResult {
  const totalExpensesCents = sumLineItems(lineItems);

  const allocations = tenants.map((tenant) =>
    calculateTenantAllocation(tenant, totalExpensesCents, config.totalLeasableArea)
  );

  const allocatedTotal = allocations.reduce((acc, a) => acc + a.actualAmountCents, 0);
  const isBalanced = allocatedTotal === totalExpensesCents;

  return {
    totalExpensesCents,
    allocations,
    isBalanced,
  };
}

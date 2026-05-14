/**
 * CAM (Common Area Maintenance) Reconciliation Types
 *
 * All monetary values are represented as integer cents to avoid floating-point issues.
 */

/** Supported allocation methods */
export type AllocationMethod =
  | 'pro_rata'
  | 'fixed_percentage'
  | 'base_year_stop'
  | 'modified_gross';

/** Tenant lease information relevant to CAM calculations */
export interface TenantLease {
  tenantId: string;
  squareFootage: number;
  camCapCents?: number;
  estimatedCAMCents: number;
  /** Fixed percentage share (0-1), used with 'fixed_percentage' method */
  fixedPercentage?: number;
  /** Base year expense amount in cents, used with 'base_year_stop' method */
  baseYearAmountCents?: number;
  /** Categories excluded for this tenant */
  excludedCategories?: string[];
}

/** A line item in CAM expenses */
export interface CAMLineItem {
  category: string;
  description: string;
  amountCents: number;
}

/** Configuration for a CAM reconciliation */
export interface ReconciliationConfig {
  propertyId: string;
  totalLeasableArea: number;
  periodStart: string;
  periodEnd: string;
}

/** A tenant's computed allocation result */
export interface TenantAllocation {
  tenantId: string;
  squareFootage: number;
  sharePercentage: number;
  estimatedAmountCents: number;
  actualAmountCents: number;
  varianceCents: number;
}

/** Result of a full CAM reconciliation */
export interface ReconciliationResult {
  totalExpensesCents: number;
  allocations: TenantAllocation[];
  isBalanced: boolean;
}

/** Options for what-if simulation */
export interface WhatIfOptions {
  allocationMethod: AllocationMethod;
  grossUpEnabled: boolean;
  targetOccupancy: number;
  exclusions: string[];
}

/** What-if simulation result (extends ReconciliationResult with metadata) */
export interface WhatIfResult extends ReconciliationResult {
  appliedMethod: AllocationMethod;
  grossUpApplied: boolean;
  originalTotalExpensesCents: number;
  excludedCategories: string[];
}

/** Variance explanation for a tenant */
export interface VarianceExplanation {
  tenantId: string;
  explanation: string;
  variancePercentage: number;
}

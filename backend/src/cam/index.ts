export {
  calculateProRataShare,
  sumLineItems,
  applyCAMCap,
  calculateTenantAllocation,
  reconcile,
  reconcileWithMethod,
  grossUpExpenses,
  applyExclusions,
  whatIfReconcile,
} from './cam.engine';

export type {
  TenantLease,
  CAMLineItem,
  ReconciliationConfig,
  TenantAllocation,
  ReconciliationResult,
  AllocationMethod,
  WhatIfOptions,
  WhatIfResult,
  VarianceExplanation,
} from './cam.types';

export { generateVarianceExplanation } from './cam.explain';
export { camService } from './cam.service';
export { default as camRoutes } from './cam.routes';

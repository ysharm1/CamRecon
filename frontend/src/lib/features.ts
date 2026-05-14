/**
 * Feature flags for PropDoc v1.
 *
 * We ship a narrow, focused product:
 *   - AI Lease Abstraction
 *   - CAM Reconciliation
 *   - Document management
 *   - Properties + Tenants
 *   - QuickBooks sync
 *
 * Everything else is built but hidden behind feature flags. Flip them on
 * for internal demos or specific customer trials by setting them in
 * localStorage:
 *
 *   localStorage.setItem('propdoc_labs', JSON.stringify({ whatIfSimulator: true }))
 *
 * Or in the browser console during a demo.
 */

export type FeatureKey =
  | 'tenantPortal'
  | 'ownerPortal'
  | 'stripePayments'
  | 'billingDashboard'
  | 'docusign'
  | 'whatIfSimulator'
  | 'yardiMriImport'
  | 'onboardingWizard';

export const FEATURE_DEFAULTS: Record<FeatureKey, boolean> = {
  tenantPortal: false,
  ownerPortal: false,
  stripePayments: false,
  billingDashboard: false,
  docusign: false,
  whatIfSimulator: false,
  yardiMriImport: false,
  onboardingWizard: false,
};

const STORAGE_KEY = 'propdoc_labs';

function readOverrides(): Partial<Record<FeatureKey, boolean>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function isFeatureEnabled(key: FeatureKey): boolean {
  const overrides = readOverrides();
  if (key in overrides) return !!overrides[key];
  return FEATURE_DEFAULTS[key];
}

/**
 * Convenience object that evaluates every flag once.
 * Prefer calling `isFeatureEnabled(key)` directly for React components
 * so changes to localStorage are reflected on the next render.
 */
export const FEATURES = Object.fromEntries(
  (Object.keys(FEATURE_DEFAULTS) as FeatureKey[]).map((key) => [key, isFeatureEnabled(key)])
) as Record<FeatureKey, boolean>;

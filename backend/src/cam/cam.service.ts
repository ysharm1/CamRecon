/**
 * CAM Reconciliation Service
 *
 * Handles business logic for initiating, storing, and retrieving
 * CAM reconciliation results.
 */

import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { reconcile } from './cam.engine';
import type { TenantLease, CAMLineItem } from './cam.types';

export interface InitiateReconciliationInput {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  lineItems: { category: string; description: string; amountCents: number }[];
}

export interface ReconciliationRecord {
  id: string;
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  totalExpensesCents: number;
  status: string;
  createdBy: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: LineItemRecord[];
  allocations?: AllocationRecord[];
}

export interface LineItemRecord {
  id: string;
  reconciliationId: string;
  category: string;
  description: string;
  amountCents: number;
}

export interface AllocationRecord {
  id: string;
  reconciliationId: string;
  tenantId: string;
  squareFootage: number;
  sharePercentage: number;
  estimatedAmountCents: number;
  actualAmountCents: number;
  varianceCents: number;
}

/**
 * Initiate a new CAM reconciliation for a property and period.
 */
export async function initiateReconciliation(
  input: InitiateReconciliationInput,
  userId: string
): Promise<ReconciliationRecord> {
  const { propertyId, periodStart, periodEnd, lineItems } = input;

  // 1. Fetch property from DB, validate it exists
  const property = await db('properties').where({ id: propertyId }).first();
  if (!property) {
    throw new AppError(404, 'PROPERTY_NOT_FOUND', `Property ${propertyId} not found`);
  }

  // 2. Fetch active tenants for the property
  const tenants = await db('tenants')
    .where({ property_id: propertyId, status: 'active' })
    .select('*');

  if (tenants.length === 0) {
    throw new AppError(
      400,
      'NO_ACTIVE_TENANTS',
      'No active tenants found for this property'
    );
  }

  // 3. Fetch lease abstractions for those tenants to get estimatedCAM and camCap
  const tenantIds = tenants.map((t: { id: string }) => t.id);
  const leaseAbstractions = await db('lease_abstractions')
    .whereIn('tenant_id', tenantIds)
    .where('review_status', 'approved')
    .select('*');

  // Build a map of tenant_id -> lease abstraction
  const leaseMap = new Map<string, { cam_cap_cents: number | null; base_rent_cents: number }>();
  for (const la of leaseAbstractions) {
    leaseMap.set(la.tenant_id, la);
  }

  // 4. Validate: sum of tenant square footages <= property.total_square_footage
  const totalTenantSqFt = tenants.reduce(
    (sum: number, t: { square_footage: number }) => sum + t.square_footage,
    0
  );
  if (totalTenantSqFt > property.total_square_footage) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Sum of tenant square footages exceeds total leasable area',
      {
        totalTenantSquareFootage: totalTenantSqFt,
        totalLeasableArea: property.total_square_footage,
      }
    );
  }

  // 5. Validate: all tenants have lease abstractions with required terms
  const tenantsWithoutLeases: string[] = [];
  for (const tenant of tenants) {
    if (!leaseMap.has(tenant.id)) {
      tenantsWithoutLeases.push(tenant.id);
    }
  }
  if (tenantsWithoutLeases.length > 0) {
    throw new AppError(
      400,
      'MISSING_LEASE_TERMS',
      'Required lease terms are missing for one or more tenants',
      { tenantIds: tenantsWithoutLeases }
    );
  }

  // 6. Build TenantLease[] and CAMLineItem[] for the engine
  const tenantLeases: TenantLease[] = tenants.map((t: { id: string; square_footage: number }) => {
    const lease = leaseMap.get(t.id)!;
    return {
      tenantId: t.id,
      squareFootage: t.square_footage,
      camCapCents: lease.cam_cap_cents ?? undefined,
      estimatedCAMCents: lease.base_rent_cents, // Use base rent as estimated CAM for demo
    };
  });

  const engineLineItems: CAMLineItem[] = lineItems.map((li) => ({
    category: li.category,
    description: li.description,
    amountCents: li.amountCents,
  }));

  // 7. Call reconcile() from cam.engine
  const result = reconcile(
    {
      propertyId,
      totalLeasableArea: property.total_square_footage,
      periodStart,
      periodEnd,
    },
    engineLineItems,
    tenantLeases
  );

  // 8. Verify allocation percentages sum to ~1.0 (within 0.0001 tolerance)
  //    when tenants cover full area
  const totalSharePercentage = result.allocations.reduce(
    (sum, a) => sum + a.sharePercentage,
    0.0
  );
  if (totalTenantSqFt === property.total_square_footage) {
    if (Math.abs(totalSharePercentage - 1.0) > 0.0001) {
      throw new AppError(
        500,
        'ALLOCATION_ERROR',
        'Allocation percentages do not sum to 1.0 within tolerance',
        { totalSharePercentage }
      );
    }
  }

  // 9. Store results in database within a transaction
  const reconciliation = await db.transaction(async (trx) => {
    // Insert reconciliation record
    const [reconciliationRow] = await trx('cam_reconciliations')
      .insert({
        property_id: propertyId,
        period_start: periodStart,
        period_end: periodEnd,
        total_expenses_cents: result.totalExpensesCents,
        status: 'completed',
        created_by: userId,
        completed_at: new Date().toISOString(),
      })
      .returning('*');

    const reconciliationId = reconciliationRow.id;

    // Insert line items
    const lineItemRows = await trx('cam_line_items')
      .insert(
        engineLineItems.map((li) => ({
          reconciliation_id: reconciliationId,
          category: li.category,
          description: li.description,
          amount_cents: li.amountCents,
        }))
      )
      .returning('*');

    // Insert tenant allocations
    const allocationRows = await trx('tenant_allocations')
      .insert(
        result.allocations.map((a) => ({
          reconciliation_id: reconciliationId,
          tenant_id: a.tenantId,
          square_footage: a.squareFootage,
          share_percentage: a.sharePercentage,
          estimated_amount_cents: a.estimatedAmountCents,
          actual_amount_cents: a.actualAmountCents,
          variance_cents: a.varianceCents,
        }))
      )
      .returning('*');

    return {
      reconciliation: reconciliationRow,
      lineItems: lineItemRows,
      allocations: allocationRows,
    };
  });

  return formatReconciliationRecord(
    reconciliation.reconciliation,
    reconciliation.lineItems,
    reconciliation.allocations
  );
}

/**
 * Get a reconciliation by ID with line items and allocations.
 */
export async function getReconciliation(id: string): Promise<ReconciliationRecord> {
  const reconciliation = await db('cam_reconciliations').where({ id }).first();
  if (!reconciliation) {
    throw new AppError(404, 'RECONCILIATION_NOT_FOUND', `Reconciliation ${id} not found`);
  }

  const lineItems = await db('cam_line_items')
    .where({ reconciliation_id: id })
    .select('*');

  const allocations = await db('tenant_allocations')
    .where({ reconciliation_id: id })
    .select('*');

  return formatReconciliationRecord(reconciliation, lineItems, allocations);
}

/**
 * List all reconciliations for a property.
 */
export async function listReconciliations(propertyId: string): Promise<ReconciliationRecord[]> {
  const reconciliations = await db('cam_reconciliations')
    .where({ property_id: propertyId })
    .orderBy('created_at', 'desc')
    .select('*');

  return reconciliations.map((r: Record<string, unknown>) =>
    formatReconciliationRecord(r, [], [])
  );
}

/**
 * Format a raw DB row into a ReconciliationRecord.
 */
function formatReconciliationRecord(
  row: Record<string, unknown>,
  lineItems: Record<string, unknown>[],
  allocations: Record<string, unknown>[]
): ReconciliationRecord {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    totalExpensesCents: row.total_expenses_cents as number,
    status: row.status as string,
    createdBy: row.created_by as string,
    completedAt: (row.completed_at as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lineItems: lineItems.map((li) => ({
      id: li.id as string,
      reconciliationId: li.reconciliation_id as string,
      category: li.category as string,
      description: li.description as string,
      amountCents: li.amount_cents as number,
    })),
    allocations: allocations.map((a) => ({
      id: a.id as string,
      reconciliationId: a.reconciliation_id as string,
      tenantId: a.tenant_id as string,
      squareFootage: a.square_footage as number,
      sharePercentage: a.share_percentage as number,
      estimatedAmountCents: a.estimated_amount_cents as number,
      actualAmountCents: a.actual_amount_cents as number,
      varianceCents: a.variance_cents as number,
    })),
  };
}

export const camService = {
  initiateReconciliation,
  getReconciliation,
  listReconciliations,
};

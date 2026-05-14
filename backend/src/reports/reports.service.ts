/**
 * Reports Service
 *
 * Business logic for fetching data needed to generate reports:
 * - Tenant statements (charge breakdown for a tenant/period)
 * - Variance reports (estimated vs actual allocations)
 * - Reconciliation packages (complete audit document)
 */

import db from '../db';
import { AppError } from '../middleware/errorHandler';

/** Data structure for a tenant statement report */
export interface TenantStatementData {
  tenant: {
    id: string;
    name: string;
    contactEmail: string;
    suiteNumber: string;
    squareFootage: number;
  };
  property: {
    id: string;
    name: string;
    address: Record<string, unknown>;
  };
  periodStart: string;
  periodEnd: string;
  allocations: {
    reconciliationId: string;
    periodStart: string;
    periodEnd: string;
    sharePercentage: number;
    estimatedAmountCents: number;
    actualAmountCents: number;
    varianceCents: number;
    lineItems: {
      category: string;
      description: string;
      amountCents: number;
    }[];
  }[];
  totalEstimatedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}

/** Data structure for a variance report */
export interface VarianceReportData {
  reconciliation: {
    id: string;
    periodStart: string;
    periodEnd: string;
    totalExpensesCents: number;
    status: string;
    completedAt: string | null;
  };
  property: {
    id: string;
    name: string;
    address: Record<string, unknown>;
    totalSquareFootage: number;
  };
  allocations: {
    tenantId: string;
    tenantName: string;
    suiteNumber: string;
    squareFootage: number;
    sharePercentage: number;
    estimatedAmountCents: number;
    actualAmountCents: number;
    varianceCents: number;
  }[];
  lineItems: {
    category: string;
    description: string;
    amountCents: number;
  }[];
  totalEstimatedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}

/** Data structure for a reconciliation package */
export interface ReconciliationPackageData {
  reconciliation: VarianceReportData['reconciliation'];
  property: VarianceReportData['property'];
  lineItems: VarianceReportData['lineItems'];
  allocations: VarianceReportData['allocations'];
  expenseSummary: {
    category: string;
    totalCents: number;
  }[];
  totalEstimatedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
  generatedAt: string;
}

/**
 * Fetch data for a tenant statement report.
 */
export async function getTenantStatementData(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): Promise<TenantStatementData> {
  // Fetch tenant
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
  }

  // Fetch property
  const property = await db('properties').where({ id: tenant.property_id }).first();
  if (!property) {
    throw new AppError(404, 'PROPERTY_NOT_FOUND', `Property not found for tenant ${tenantId}`);
  }

  // Fetch allocations for this tenant within the period
  const allocations = await db('tenant_allocations as ta')
    .join('cam_reconciliations as cr', 'ta.reconciliation_id', 'cr.id')
    .where('ta.tenant_id', tenantId)
    .where('cr.period_start', '>=', periodStart)
    .where('cr.period_end', '<=', periodEnd)
    .select(
      'ta.reconciliation_id',
      'cr.period_start',
      'cr.period_end',
      'ta.share_percentage',
      'ta.estimated_amount_cents',
      'ta.actual_amount_cents',
      'ta.variance_cents'
    );

  // For each allocation, fetch the line items from the reconciliation
  const allocationsWithLineItems = await Promise.all(
    allocations.map(async (alloc: Record<string, unknown>) => {
      const lineItems = await db('cam_line_items')
        .where({ reconciliation_id: alloc.reconciliation_id as string })
        .select('category', 'description', 'amount_cents');

      return {
        reconciliationId: alloc.reconciliation_id as string,
        periodStart: alloc.period_start as string,
        periodEnd: alloc.period_end as string,
        sharePercentage: alloc.share_percentage as number,
        estimatedAmountCents: alloc.estimated_amount_cents as number,
        actualAmountCents: alloc.actual_amount_cents as number,
        varianceCents: alloc.variance_cents as number,
        lineItems: lineItems.map((li: Record<string, unknown>) => ({
          category: li.category as string,
          description: li.description as string,
          amountCents: li.amount_cents as number,
        })),
      };
    })
  );

  const totalEstimatedCents = allocationsWithLineItems.reduce(
    (sum, a) => sum + a.estimatedAmountCents,
    0
  );
  const totalActualCents = allocationsWithLineItems.reduce(
    (sum, a) => sum + a.actualAmountCents,
    0
  );
  const totalVarianceCents = allocationsWithLineItems.reduce(
    (sum, a) => sum + a.varianceCents,
    0
  );

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      contactEmail: tenant.contact_email,
      suiteNumber: tenant.suite_number,
      squareFootage: tenant.square_footage,
    },
    property: {
      id: property.id,
      name: property.name,
      address: property.address,
    },
    periodStart,
    periodEnd,
    allocations: allocationsWithLineItems,
    totalEstimatedCents,
    totalActualCents,
    totalVarianceCents,
  };
}

/**
 * Fetch data for a variance report.
 */
export async function getVarianceReportData(
  reconciliationId: string
): Promise<VarianceReportData> {
  // Fetch reconciliation
  const reconciliation = await db('cam_reconciliations')
    .where({ id: reconciliationId })
    .first();
  if (!reconciliation) {
    throw new AppError(
      404,
      'RECONCILIATION_NOT_FOUND',
      `Reconciliation ${reconciliationId} not found`
    );
  }

  // Fetch property
  const property = await db('properties')
    .where({ id: reconciliation.property_id })
    .first();

  // Fetch allocations with tenant info
  const allocations = await db('tenant_allocations as ta')
    .join('tenants as t', 'ta.tenant_id', 't.id')
    .where('ta.reconciliation_id', reconciliationId)
    .select(
      'ta.tenant_id',
      't.name as tenant_name',
      't.suite_number',
      'ta.square_footage',
      'ta.share_percentage',
      'ta.estimated_amount_cents',
      'ta.actual_amount_cents',
      'ta.variance_cents'
    );

  // Fetch line items
  const lineItems = await db('cam_line_items')
    .where({ reconciliation_id: reconciliationId })
    .select('category', 'description', 'amount_cents');

  const formattedAllocations = allocations.map((a: Record<string, unknown>) => ({
    tenantId: a.tenant_id as string,
    tenantName: a.tenant_name as string,
    suiteNumber: a.suite_number as string,
    squareFootage: a.square_footage as number,
    sharePercentage: a.share_percentage as number,
    estimatedAmountCents: a.estimated_amount_cents as number,
    actualAmountCents: a.actual_amount_cents as number,
    varianceCents: a.variance_cents as number,
  }));

  const formattedLineItems = lineItems.map((li: Record<string, unknown>) => ({
    category: li.category as string,
    description: li.description as string,
    amountCents: li.amount_cents as number,
  }));

  const totalEstimatedCents = formattedAllocations.reduce(
    (sum, a) => sum + a.estimatedAmountCents,
    0
  );
  const totalActualCents = formattedAllocations.reduce(
    (sum, a) => sum + a.actualAmountCents,
    0
  );
  const totalVarianceCents = formattedAllocations.reduce(
    (sum, a) => sum + a.varianceCents,
    0
  );

  return {
    reconciliation: {
      id: reconciliation.id,
      periodStart: reconciliation.period_start,
      periodEnd: reconciliation.period_end,
      totalExpensesCents: reconciliation.total_expenses_cents,
      status: reconciliation.status,
      completedAt: reconciliation.completed_at || null,
    },
    property: {
      id: property.id,
      name: property.name,
      address: property.address,
      totalSquareFootage: property.total_square_footage,
    },
    allocations: formattedAllocations,
    lineItems: formattedLineItems,
    totalEstimatedCents,
    totalActualCents,
    totalVarianceCents,
  };
}

/**
 * Fetch data for a reconciliation package report.
 */
export async function getReconciliationPackageData(
  reconciliationId: string
): Promise<ReconciliationPackageData> {
  const varianceData = await getVarianceReportData(reconciliationId);

  // Build expense summary by category
  const categoryMap = new Map<string, number>();
  for (const item of varianceData.lineItems) {
    const current = categoryMap.get(item.category) || 0;
    categoryMap.set(item.category, current + item.amountCents);
  }

  const expenseSummary = Array.from(categoryMap.entries()).map(([category, totalCents]) => ({
    category,
    totalCents,
  }));

  return {
    reconciliation: varianceData.reconciliation,
    property: varianceData.property,
    lineItems: varianceData.lineItems,
    allocations: varianceData.allocations,
    expenseSummary,
    totalEstimatedCents: varianceData.totalEstimatedCents,
    totalActualCents: varianceData.totalActualCents,
    totalVarianceCents: varianceData.totalVarianceCents,
    generatedAt: new Date().toISOString(),
  };
}

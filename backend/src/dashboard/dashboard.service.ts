/**
 * Dashboard Service
 *
 * Provides aggregated data for the dashboard including:
 * - Portfolio metrics (total properties, tenants, occupancy rate, total area)
 * - Upcoming lease expirations (30/60/90 day buckets)
 * - Pending CAM reconciliations
 * - Overdue documents requiring action
 *
 * All queries are scoped to the authenticated user's organization.
 */

import db from '../db';

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

/**
 * Get portfolio-level metrics scoped to an organization.
 */
export async function getPortfolioMetrics(organizationId: string): Promise<PortfolioMetrics> {
  // Get properties for this organization
  const properties = await db('properties')
    .where({ owner_id: organizationId })
    .select('id', 'total_square_footage');

  const totalProperties = properties.length;
  const totalLeasableArea = properties.reduce(
    (sum: number, p: { total_square_footage: number }) => sum + p.total_square_footage,
    0
  );

  if (totalProperties === 0) {
    return {
      totalProperties: 0,
      totalTenants: 0,
      occupancyRate: 0,
      totalLeasableArea: 0,
    };
  }

  const propertyIds = properties.map((p: { id: string }) => p.id);

  // Get active tenants for these properties
  const tenants = await db('tenants')
    .whereIn('property_id', propertyIds)
    .where({ status: 'active' })
    .select('square_footage');

  const totalTenants = tenants.length;
  const totalOccupiedArea = tenants.reduce(
    (sum: number, t: { square_footage: number }) => sum + t.square_footage,
    0
  );

  const occupancyRate = totalLeasableArea > 0
    ? Math.round((totalOccupiedArea / totalLeasableArea) * 10000) / 10000
    : 0;

  return {
    totalProperties,
    totalTenants,
    occupancyRate,
    totalLeasableArea,
  };
}

/**
 * Get upcoming lease expirations within 30/60/90 days, scoped to organization.
 */
export async function getLeaseExpirations(organizationId: string): Promise<LeaseExpirations> {
  const now = new Date();
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);
  const in60Days = new Date(now);
  in60Days.setDate(in60Days.getDate() + 60);
  const in90Days = new Date(now);
  in90Days.setDate(in90Days.getDate() + 90);

  // Get property IDs for this organization
  const propertyIds = await db('properties')
    .where({ owner_id: organizationId })
    .pluck('id');

  if (propertyIds.length === 0) {
    return { within30Days: 0, within60Days: 0, within90Days: 0, items: [] };
  }

  // Query lease abstractions with expiration within 90 days
  const expiringLeases = await db('lease_abstractions as la')
    .join('tenants as t', 'la.tenant_id', 't.id')
    .join('properties as p', 't.property_id', 'p.id')
    .whereIn('t.property_id', propertyIds)
    .where('la.expiration_date', '>=', now.toISOString().split('T')[0])
    .where('la.expiration_date', '<=', in90Days.toISOString().split('T')[0])
    .select(
      'la.id',
      'la.tenant_id',
      'la.expiration_date',
      't.name as tenant_name',
      'p.name as property_name'
    )
    .orderBy('la.expiration_date', 'asc');

  const items: LeaseExpirationItem[] = expiringLeases.map((lease: {
    id: string;
    tenant_id: string;
    expiration_date: string;
    tenant_name: string;
    property_name: string;
  }) => {
    const expirationDate = new Date(lease.expiration_date);
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: lease.id,
      tenantId: lease.tenant_id,
      tenantName: lease.tenant_name,
      propertyName: lease.property_name,
      expirationDate: lease.expiration_date,
      daysUntilExpiration,
    };
  });

  const within30Days = items.filter((i) => i.daysUntilExpiration <= 30).length;
  const within60Days = items.filter((i) => i.daysUntilExpiration <= 60).length;
  const within90Days = items.length;

  return {
    within30Days,
    within60Days,
    within90Days,
    items,
  };
}

/**
 * Get pending CAM reconciliations (not completed or approved), scoped to organization.
 */
export async function getPendingReconciliations(
  organizationId: string
): Promise<PendingReconciliation[]> {
  const propertyIds = await db('properties')
    .where({ owner_id: organizationId })
    .pluck('id');

  if (propertyIds.length === 0) {
    return [];
  }

  const reconciliations = await db('cam_reconciliations as cr')
    .join('properties as p', 'cr.property_id', 'p.id')
    .whereIn('cr.property_id', propertyIds)
    .whereNotIn('cr.status', ['completed', 'approved'])
    .select(
      'cr.id',
      'cr.property_id',
      'p.name as property_name',
      'cr.period_start',
      'cr.period_end',
      'cr.status',
      'cr.created_at'
    )
    .orderBy('cr.created_at', 'desc');

  return reconciliations.map((r: {
    id: string;
    property_id: string;
    property_name: string;
    period_start: string;
    period_end: string;
    status: string;
    created_at: string;
  }) => ({
    id: r.id,
    propertyId: r.property_id,
    propertyName: r.property_name,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/**
 * Get overdue documents (lease abstractions with review_status='pending'), scoped to organization.
 */
export async function getOverdueDocuments(organizationId: string): Promise<OverdueDocument[]> {
  const propertyIds = await db('properties')
    .where({ owner_id: organizationId })
    .pluck('id');

  if (propertyIds.length === 0) {
    return [];
  }

  const overdueAbstractions = await db('lease_abstractions as la')
    .join('tenants as t', 'la.tenant_id', 't.id')
    .join('properties as p', 't.property_id', 'p.id')
    .whereIn('t.property_id', propertyIds)
    .where('la.review_status', 'pending')
    .select(
      'la.id',
      'la.document_id',
      't.name as tenant_name',
      'p.name as property_name',
      'la.review_status',
      'la.created_at'
    )
    .orderBy('la.created_at', 'asc');

  return overdueAbstractions.map((doc: {
    id: string;
    document_id: string;
    tenant_name: string;
    property_name: string;
    review_status: string;
    created_at: string;
  }) => ({
    id: doc.id,
    documentId: doc.document_id,
    tenantName: doc.tenant_name,
    propertyName: doc.property_name,
    reviewStatus: doc.review_status,
    createdAt: doc.created_at,
  }));
}

/**
 * Get all dashboard data in a single call, scoped to organization.
 */
export async function getDashboardData(organizationId: string): Promise<DashboardData> {
  const [metrics, leaseExpirations, pendingReconciliations, overdueDocuments] = await Promise.all([
    getPortfolioMetrics(organizationId),
    getLeaseExpirations(organizationId),
    getPendingReconciliations(organizationId),
    getOverdueDocuments(organizationId),
  ]);

  return {
    metrics,
    leaseExpirations,
    pendingReconciliations,
    overdueDocuments,
  };
}

export const dashboardService = {
  getDashboardData,
  getPortfolioMetrics,
  getLeaseExpirations,
  getPendingReconciliations,
  getOverdueDocuments,
};

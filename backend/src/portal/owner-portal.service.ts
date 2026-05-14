/**
 * Owner Portal Service
 *
 * Provides property-level financial summaries and branded PDF report generation
 * for property owners and investors.
 */

import { randomBytes, createHash } from 'crypto';
import db from '../db';
import { AppError } from '../middleware/errorHandler';

/**
 * Generate a cryptographically secure random token string.
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256 for secure storage.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface OwnerPropertySummary {
  id: string;
  name: string;
  address: Record<string, unknown>;
  totalSquareFootage: number;
  propertyType: string;
  occupancyRate: number;
  totalTenants: number;
  activeTenants: number;
  totalRevenueCents: number;
  camRecoveryRate: number;
}

export interface OwnerReportData {
  property: {
    id: string;
    name: string;
    address: Record<string, unknown>;
    totalSquareFootage: number;
    propertyType: string;
  };
  organization: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    reportHeader: string | null;
  };
  occupancyRate: number;
  revenueSummary: {
    totalRentCollectedCents: number;
    totalCamCollectedCents: number;
    totalRevenueCents: number;
  };
  camRecoveryRate: number;
  leaseExpirations: Array<{
    tenantName: string;
    suiteNumber: string;
    expirationDate: string;
    squareFootage: number;
  }>;
  tenantRoster: Array<{
    name: string;
    suiteNumber: string;
    squareFootage: number;
    status: string;
    contactEmail: string;
  }>;
}

/**
 * Create a portal token for an owner/investor.
 */
export async function createOwnerPortalToken(
  propertyIds: string[],
  expiresInDays: number = 30
): Promise<{ id: string; token: string; expiresAt: Date }> {
  if (!propertyIds || propertyIds.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one property ID is required');
  }

  // Verify all properties exist
  const properties = await db('properties').whereIn('id', propertyIds);
  if (properties.length !== propertyIds.length) {
    throw new AppError(404, 'PROPERTY_NOT_FOUND', 'One or more properties not found');
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [record] = await db('portal_tokens')
    .insert({
      tenant_id: null,
      token: tokenHash,
      expires_at: expiresAt,
      is_revoked: false,
      portal_type: 'owner',
      property_ids: JSON.stringify(propertyIds),
    })
    .returning(['id', 'expires_at']);

  return {
    id: record.id,
    token,
    expiresAt: new Date(record.expires_at),
  };
}

/**
 * Verify an owner portal token and return accessible property IDs.
 */
export async function verifyOwnerToken(token: string): Promise<{
  propertyIds: string[];
}> {
  const tokenHash = hashToken(token);

  const portalToken = await db('portal_tokens')
    .where({ token: tokenHash, is_revoked: false, portal_type: 'owner' })
    .first();

  if (!portalToken) {
    throw new AppError(401, 'INVALID_PORTAL_TOKEN', 'Invalid or revoked owner portal token');
  }

  const now = new Date();
  const expiresAt = new Date(portalToken.expires_at);
  if (now > expiresAt) {
    throw new AppError(401, 'EXPIRED_PORTAL_TOKEN', 'Owner portal token has expired');
  }

  const propertyIds = typeof portalToken.property_ids === 'string'
    ? JSON.parse(portalToken.property_ids)
    : portalToken.property_ids;

  return { propertyIds: propertyIds || [] };
}

/**
 * Get property summaries for an owner.
 */
export async function getOwnerProperties(propertyIds: string[]): Promise<OwnerPropertySummary[]> {
  const properties = await db('properties')
    .whereIn('id', propertyIds)
    .select('*');

  const summaries: OwnerPropertySummary[] = [];

  for (const property of properties) {
    // Get tenant counts
    const tenantCounts = await db('tenants')
      .where({ property_id: property.id })
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(*) FILTER (WHERE status = 'active') as active")
      )
      .first();

    const totalTenants = Number(tenantCounts?.total || 0);
    const activeTenants = Number(tenantCounts?.active || 0);

    // Calculate occupancy rate based on active tenant square footage
    const occupiedSqFt = await db('tenants')
      .where({ property_id: property.id, status: 'active' })
      .sum('square_footage as total')
      .first();

    const occupancyRate = property.total_square_footage > 0
      ? Number(occupiedSqFt?.total || 0) / property.total_square_footage
      : 0;

    // Get total revenue (sum of actual amounts from allocations)
    const revenueResult = await db('tenant_allocations as ta')
      .join('cam_reconciliations as cr', 'ta.reconciliation_id', 'cr.id')
      .where('cr.property_id', property.id)
      .sum('ta.actual_amount_cents as total_revenue')
      .first();

    const totalRevenueCents = Number(revenueResult?.total_revenue || 0);

    // Calculate CAM recovery rate (actual collected / total expenses)
    const camResult = await db('cam_reconciliations')
      .where({ property_id: property.id, status: 'completed' })
      .sum('total_expenses_cents as total_expenses')
      .first();

    const totalExpenses = Number(camResult?.total_expenses || 0);
    const camRecoveryRate = totalExpenses > 0 ? totalRevenueCents / totalExpenses : 0;

    summaries.push({
      id: property.id,
      name: property.name,
      address: property.address,
      totalSquareFootage: property.total_square_footage,
      propertyType: property.property_type,
      occupancyRate,
      totalTenants,
      activeTenants,
      totalRevenueCents,
      camRecoveryRate,
    });
  }

  return summaries;
}

/**
 * Get full report data for a property (used for PDF generation).
 */
export async function getOwnerReportData(propertyId: string): Promise<OwnerReportData> {
  const property = await db('properties').where({ id: propertyId }).first();
  if (!property) {
    throw new AppError(404, 'PROPERTY_NOT_FOUND', 'Property not found');
  }

  // Get organization branding
  const organization = await db('organizations').where({ id: property.owner_id }).first();
  if (!organization) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
  }

  // Calculate occupancy
  const occupiedSqFt = await db('tenants')
    .where({ property_id: propertyId, status: 'active' })
    .sum('square_footage as total')
    .first();

  const occupancyRate = property.total_square_footage > 0
    ? Number(occupiedSqFt?.total || 0) / property.total_square_footage
    : 0;

  // Revenue summary from allocations
  const revenueResult = await db('tenant_allocations as ta')
    .join('cam_reconciliations as cr', 'ta.reconciliation_id', 'cr.id')
    .where('cr.property_id', propertyId)
    .select(
      db.raw('COALESCE(SUM(ta.estimated_amount_cents), 0) as total_rent'),
      db.raw('COALESCE(SUM(ta.actual_amount_cents), 0) as total_cam')
    )
    .first();

  const totalRentCollectedCents = Number(revenueResult?.total_rent || 0);
  const totalCamCollectedCents = Number(revenueResult?.total_cam || 0);

  // CAM recovery rate
  const camExpenses = await db('cam_reconciliations')
    .where({ property_id: propertyId, status: 'completed' })
    .sum('total_expenses_cents as total')
    .first();

  const totalExpenses = Number(camExpenses?.total || 0);
  const camRecoveryRate = totalExpenses > 0 ? totalCamCollectedCents / totalExpenses : 0;

  // Lease expirations (from lease_abstractions)
  const leaseExpirations = await db('lease_abstractions as la')
    .join('tenants as t', 'la.tenant_id', 't.id')
    .where('t.property_id', propertyId)
    .where('t.status', 'active')
    .select('t.name as tenant_name', 't.suite_number', 'la.expiration_date', 't.square_footage')
    .orderBy('la.expiration_date', 'asc');

  // Tenant roster
  const tenantRoster = await db('tenants')
    .where({ property_id: propertyId })
    .select('name', 'suite_number', 'square_footage', 'status', 'contact_email')
    .orderBy('suite_number', 'asc');

  return {
    property: {
      id: property.id,
      name: property.name,
      address: property.address,
      totalSquareFootage: property.total_square_footage,
      propertyType: property.property_type,
    },
    organization: {
      name: organization.name,
      logoUrl: organization.logo_url || null,
      primaryColor: organization.primary_color || '#4f46e5',
      reportHeader: organization.report_header || null,
    },
    occupancyRate,
    revenueSummary: {
      totalRentCollectedCents,
      totalCamCollectedCents,
      totalRevenueCents: totalRentCollectedCents + totalCamCollectedCents,
    },
    camRecoveryRate,
    leaseExpirations: leaseExpirations.map((le: {
      tenant_name: string;
      suite_number: string;
      expiration_date: string;
      square_footage: number;
    }) => ({
      tenantName: le.tenant_name,
      suiteNumber: le.suite_number,
      expirationDate: le.expiration_date,
      squareFootage: le.square_footage,
    })),
    tenantRoster: tenantRoster.map((t: {
      name: string;
      suite_number: string;
      square_footage: number;
      status: string;
      contact_email: string;
    }) => ({
      name: t.name,
      suiteNumber: t.suite_number,
      squareFootage: t.square_footage,
      status: t.status,
      contactEmail: t.contact_email,
    })),
  };
}

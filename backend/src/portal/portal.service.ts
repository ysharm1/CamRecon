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
 * Raw tokens are never stored in the database.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new portal access token for a tenant.
 * Admin-only operation.
 */
export async function createPortalToken(
  tenantId: string,
  expiresInDays: number = 30
): Promise<{ id: string; token: string; expiresAt: Date }> {
  // Verify tenant exists
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found');
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [record] = await db('portal_tokens')
    .insert({
      tenant_id: tenantId,
      token: tokenHash,
      expires_at: expiresAt,
      is_revoked: false,
    })
    .returning(['id', 'expires_at']);

  return {
    id: record.id,
    token, // Return the raw token to the caller (only time it's available)
    expiresAt: new Date(record.expires_at),
  };
}

/**
 * Verify a portal token and return tenant info.
 */
export async function verifyPortalToken(token: string): Promise<{
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  suiteNumber: string;
}> {
  const tokenHash = hashToken(token);

  const portalToken = await db('portal_tokens')
    .where({ token: tokenHash, is_revoked: false })
    .first();

  if (!portalToken) {
    throw new AppError(401, 'INVALID_PORTAL_TOKEN', 'Invalid or revoked portal token');
  }

  const now = new Date();
  const expiresAt = new Date(portalToken.expires_at);
  if (now > expiresAt) {
    throw new AppError(401, 'EXPIRED_PORTAL_TOKEN', 'Portal token has expired');
  }

  const tenant = await db('tenants as t')
    .join('properties as p', 't.property_id', 'p.id')
    .where('t.id', portalToken.tenant_id)
    .select('t.id as tenant_id', 't.name as tenant_name', 'p.id as property_id', 'p.name as property_name', 't.suite_number')
    .first();

  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found');
  }

  return {
    tenantId: tenant.tenant_id,
    tenantName: tenant.tenant_name,
    propertyId: tenant.property_id,
    propertyName: tenant.property_name,
    suiteNumber: tenant.suite_number,
  };
}

/**
 * Get the tenant dashboard summary.
 */
export async function getTenantDashboard(tenantId: string): Promise<{
  tenantName: string;
  propertyName: string;
  suiteNumber: string;
  balance: number;
}> {
  const tenant = await db('tenants as t')
    .join('properties as p', 't.property_id', 'p.id')
    .where('t.id', tenantId)
    .select('t.name as tenant_name', 'p.name as property_name', 't.suite_number')
    .first();

  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found');
  }

  // Calculate outstanding balance from unpaid variances
  const balanceResult = await db('tenant_allocations')
    .where({ tenant_id: tenantId })
    .sum('variance_cents as total_variance')
    .first();

  const balance = balanceResult?.total_variance || 0;

  return {
    tenantName: tenant.tenant_name,
    propertyName: tenant.property_name,
    suiteNumber: tenant.suite_number,
    balance: Number(balance),
  };
}

/**
 * Get documents shared with a tenant.
 */
export async function getTenantDocuments(tenantId: string): Promise<Array<{
  id: string;
  title: string;
  documentType: string;
  currentVersion: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}>> {
  const documents = await db('documents')
    .where({ tenant_id: tenantId })
    .select('id', 'title', 'document_type', 'current_version', 'mime_type', 'size_bytes', 'created_at')
    .orderBy('created_at', 'desc');

  return documents.map((d: {
    id: string;
    title: string;
    document_type: string;
    current_version: number;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }) => ({
    id: d.id,
    title: d.title,
    documentType: d.document_type,
    currentVersion: d.current_version,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    createdAt: d.created_at,
  }));
}

/**
 * Get CAM statements/allocations for a tenant.
 */
export async function getTenantStatements(tenantId: string): Promise<Array<{
  id: string;
  periodStart: string;
  periodEnd: string;
  propertyName: string;
  sharePercentage: number;
  estimatedAmountCents: number;
  actualAmountCents: number;
  varianceCents: number;
  status: string;
  completedAt: string | null;
}>> {
  const allocations = await db('tenant_allocations as ta')
    .join('cam_reconciliations as cr', 'ta.reconciliation_id', 'cr.id')
    .join('properties as p', 'cr.property_id', 'p.id')
    .where('ta.tenant_id', tenantId)
    .select(
      'ta.id',
      'cr.period_start',
      'cr.period_end',
      'p.name as property_name',
      'ta.share_percentage',
      'ta.estimated_amount_cents',
      'ta.actual_amount_cents',
      'ta.variance_cents',
      'cr.status',
      'cr.completed_at'
    )
    .orderBy('cr.period_end', 'desc');

  return allocations.map((a: {
    id: string;
    period_start: string;
    period_end: string;
    property_name: string;
    share_percentage: number;
    estimated_amount_cents: number;
    actual_amount_cents: number;
    variance_cents: number;
    status: string;
    completed_at: string | null;
  }) => ({
    id: a.id,
    periodStart: a.period_start,
    periodEnd: a.period_end,
    propertyName: a.property_name,
    sharePercentage: a.share_percentage,
    estimatedAmountCents: a.estimated_amount_cents,
    actualAmountCents: a.actual_amount_cents,
    varianceCents: a.variance_cents,
    status: a.status,
    completedAt: a.completed_at,
  }));
}

/**
 * Get outstanding balance for a tenant (sum of unpaid variances).
 */
export async function getTenantBalance(tenantId: string): Promise<{
  outstandingBalanceCents: number;
  totalEstimatedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}> {
  const result = await db('tenant_allocations')
    .where({ tenant_id: tenantId })
    .select(
      db.raw('COALESCE(SUM(variance_cents), 0) as total_variance'),
      db.raw('COALESCE(SUM(estimated_amount_cents), 0) as total_estimated'),
      db.raw('COALESCE(SUM(actual_amount_cents), 0) as total_actual')
    )
    .first();

  return {
    outstandingBalanceCents: Number(result?.total_variance || 0),
    totalEstimatedCents: Number(result?.total_estimated || 0),
    totalActualCents: Number(result?.total_actual || 0),
    totalVarianceCents: Number(result?.total_variance || 0),
  };
}

/**
 * Revoke a portal token.
 */
export async function revokePortalToken(tokenId: string): Promise<void> {
  const updated = await db('portal_tokens')
    .where({ id: tokenId })
    .update({ is_revoked: true });

  if (!updated) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'Portal token not found');
  }
}

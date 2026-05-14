import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { AppError } from '../middleware/errorHandler';
import db from '../db';

/**
 * Portal tenant context attached to the request after token validation.
 */
export interface PortalTenant {
  tenantId: string;
  propertyId: string;
  tenantName: string;
}

// Extend Express Request to include portal tenant context
declare global {
  namespace Express {
    interface Request {
      portalTenant?: PortalTenant;
    }
  }
}

/**
 * Hash a token using SHA-256 for database lookup.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Portal authentication middleware.
 * Validates a portal access token from either:
 *   - Authorization: Bearer <token> header
 *   - ?token=<token> query parameter
 *
 * On success, attaches the tenant context to req.portalTenant.
 */
export async function portalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError(401, 'MISSING_PORTAL_TOKEN', 'Portal access token is required');
    }

    // Hash the token for secure database lookup
    const tokenHash = hashToken(token);

    // Look up the hashed token in the database
    const portalToken = await db('portal_tokens')
      .where({ token: tokenHash, is_revoked: false })
      .first();

    if (!portalToken) {
      throw new AppError(401, 'INVALID_PORTAL_TOKEN', 'Invalid or revoked portal token');
    }

    // Check expiry
    const now = new Date();
    const expiresAt = new Date(portalToken.expires_at);
    if (now > expiresAt) {
      throw new AppError(401, 'EXPIRED_PORTAL_TOKEN', 'Portal token has expired');
    }

    // Get tenant info
    const tenant = await db('tenants')
      .where({ id: portalToken.tenant_id })
      .first();

    if (!tenant) {
      throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant associated with this token not found');
    }

    req.portalTenant = {
      tenantId: tenant.id,
      propertyId: tenant.property_id,
      tenantName: tenant.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Extracts the portal token from the request.
 * Checks Authorization header first, then query parameter.
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }

  // Check query parameter
  const queryToken = req.query.token;
  if (queryToken && typeof queryToken === 'string') {
    return queryToken;
  }

  return null;
}

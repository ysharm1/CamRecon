/**
 * Portal Routes
 *
 * Public routes (no auth):
 *   GET /api/portal/verify/:token — Validate a portal token and return tenant info
 *
 * Admin routes (JWT auth required):
 *   POST /api/portal/tokens — Generate a new portal token for a tenant
 *
 * Portal-protected routes (portal token auth):
 *   GET /api/portal/dashboard — Tenant summary (name, property, suite, balance)
 *   GET /api/portal/documents — Documents shared with this tenant
 *   GET /api/portal/statements — CAM statements/allocations for this tenant
 *   GET /api/portal/balance — Outstanding balance
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import { portalAuthenticate } from './portal.middleware';
import {
  createPortalToken,
  verifyPortalToken,
  getTenantDashboard,
  getTenantDocuments,
  getTenantStatements,
  getTenantBalance,
} from './portal.service';

const router = Router();

/**
 * GET /api/portal/verify/:token
 * Public endpoint to verify a portal token.
 * Returns tenant info if valid.
 */
router.get('/verify/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const tenantInfo = await verifyPortalToken(token);
    res.json({ data: tenantInfo });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/portal/tokens
 * Admin-only: Generate a new portal access token for a tenant.
 * Body: { tenantId: string, expiresInDays?: number }
 */
router.post('/tokens', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    // Only admins and property managers can generate portal tokens
    if (!['admin', 'property_manager'].includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Only admins and property managers can generate portal tokens');
    }

    const { tenantId, expiresInDays } = req.body;

    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'tenantId is required');
    }

    const result = await createPortalToken(tenantId, expiresInDays || 30);

    res.status(201).json({
      data: {
        id: result.id,
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
        portalUrl: `/portal?token=${result.token}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/dashboard
 * Portal-protected: Returns tenant summary.
 */
router.get('/dashboard', portalAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.portalTenant) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Portal authentication is required');
    }

    const dashboard = await getTenantDashboard(req.portalTenant.tenantId);
    res.json({ data: dashboard });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/documents
 * Portal-protected: Returns documents shared with this tenant.
 */
router.get('/documents', portalAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.portalTenant) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Portal authentication is required');
    }

    const documents = await getTenantDocuments(req.portalTenant.tenantId);
    res.json({ data: documents });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/statements
 * Portal-protected: Returns CAM statements/allocations for this tenant.
 */
router.get('/statements', portalAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.portalTenant) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Portal authentication is required');
    }

    const statements = await getTenantStatements(req.portalTenant.tenantId);
    res.json({ data: statements });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/balance
 * Portal-protected: Returns outstanding balance for this tenant.
 */
router.get('/balance', portalAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.portalTenant) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Portal authentication is required');
    }

    const balance = await getTenantBalance(req.portalTenant.tenantId);
    res.json({ data: balance });
  } catch (error) {
    next(error);
  }
});

export default router;

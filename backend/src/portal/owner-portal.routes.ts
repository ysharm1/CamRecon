/**
 * Owner Portal Routes
 *
 * Admin routes (JWT auth required):
 *   POST /api/portal/owner/tokens — Generate a new owner portal token
 *
 * Owner portal-protected routes (owner token auth):
 *   GET /api/portal/owner/properties — List properties with financial summaries
 *   GET /api/portal/owner/reports/:propertyId — Generate branded PDF report
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import db from '../db';
import {
  createOwnerPortalToken,
  verifyOwnerToken,
  getOwnerProperties,
  getOwnerReportData,
} from './owner-portal.service';
import { generateOwnerReportPDF } from './owner-report-pdf';

const router = Router();

/**
 * Middleware to authenticate owner portal tokens.
 * Extracts token from Authorization header or query parameter.
 */
async function ownerPortalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError(401, 'MISSING_PORTAL_TOKEN', 'Owner portal access token is required');
    }

    const { propertyIds } = await verifyOwnerToken(token);
    (req as any).ownerPropertyIds = propertyIds;
    next();
  } catch (error) {
    next(error);
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  const queryToken = req.query.token;
  if (queryToken && typeof queryToken === 'string') {
    return queryToken;
  }
  return null;
}

/**
 * POST /api/portal/owner/tokens
 * Admin-only: Generate a new owner portal access token.
 * Body: { propertyIds: string[], expiresInDays?: number }
 */
router.post('/tokens', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    if (!['admin', 'property_manager'].includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Only admins and property managers can generate owner portal tokens');
    }

    const { propertyIds, expiresInDays } = req.body;

    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'propertyIds array is required');
    }

    const result = await createOwnerPortalToken(propertyIds, expiresInDays || 30);

    res.status(201).json({
      data: {
        id: result.id,
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
        portalUrl: `/portal/owner?token=${result.token}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/owner/properties
 * Owner portal-protected: Returns property summaries with financial metrics.
 */
router.get('/properties', ownerPortalAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyIds = (req as any).ownerPropertyIds;

    if (!propertyIds || propertyIds.length === 0) {
      throw new AppError(403, 'NO_PROPERTIES', 'No properties associated with this token');
    }

    const properties = await getOwnerProperties(propertyIds);
    res.json({ data: properties });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/portal/owner/reports/:propertyId
 * Owner portal-protected: Generates and returns a branded PDF report for a property.
 */
router.get('/reports/:propertyId', ownerPortalAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const propertyIds = (req as any).ownerPropertyIds as string[];
    const { propertyId } = req.params;

    // Verify the owner has access to this property
    if (!propertyIds.includes(propertyId)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this property');
    }

    const reportData = await getOwnerReportData(propertyId);
    const pdfDoc = generateOwnerReportPDF(reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="property-report-${reportData.property.name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`
    );

    pdfDoc.pipe(res);
  } catch (error) {
    next(error);
  }
});

export default router;

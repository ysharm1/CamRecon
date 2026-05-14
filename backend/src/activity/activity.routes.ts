import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { activityService } from './activity.service';
import { AppError } from '../middleware/errorHandler';
import db from '../db';

const router = Router();

/**
 * GET /api/activity
 * Retrieve recent activity across the authenticated user's organization.
 * Query params: ?limit=25
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      const limit = Math.min(Number(req.query.limit) || 25, 100);

      const entries = await db('activity_feed')
        .where({ organization_id: req.user.organizationId })
        .orderBy('created_at', 'desc')
        .limit(limit);

      res.json({ data: entries });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/activity/property/:propertyId
 * Retrieve the activity timeline for a property in reverse chronological order.
 * Scoped to the authenticated user's organization.
 */
router.get(
  '/property/:propertyId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { propertyId } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      const entries = await activityService.getPropertyTimeline(
        propertyId,
        req.user.organizationId
      );

      res.json({ data: entries });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/activity/tenant/:tenantId
 * Retrieve the activity timeline for a tenant in reverse chronological order.
 * Scoped to the authenticated user's organization.
 */
router.get(
  '/tenant/:tenantId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      const entries = await activityService.getTenantTimeline(
        tenantId,
        req.user.organizationId
      );

      res.json({ data: entries });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

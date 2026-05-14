/**
 * Dashboard Routes
 *
 * GET /api/dashboard — Returns all dashboard data scoped to the authenticated user's organization
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { dashboardService } from './dashboard.service';

const router = Router();

/**
 * GET /api/dashboard
 * Returns aggregated dashboard data including metrics, lease expirations,
 * pending reconciliations, and overdue documents.
 *
 * All data is scoped to the authenticated user's organization.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const data = await dashboardService.getDashboardData(organizationId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;

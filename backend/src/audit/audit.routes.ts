import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { auditService } from './audit.service';

const router = Router();

/**
 * GET /api/audit/:entityType/:entityId
 * Retrieve the audit trail for a specific entity.
 */
router.get(
  '/:entityType/:entityId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entityType, entityId } = req.params;

      const entries = await auditService.getAuditTrail(entityType, entityId);

      res.json({ data: entries });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

/**
 * AI Routes
 *
 * POST /api/ai/lease-summary      — Generate AI lease summary for a tenant
 * POST /api/ai/renewal-risk       — Generate renewal risk assessment for a tenant
 * POST /api/ai/document-insights  — Generate document insights (summary + risks)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import {
  generateLeaseSummary,
  generateRenewalRisk,
  generateDocumentInsights,
} from './ai.service';

const router = Router();

/**
 * POST /api/ai/lease-summary
 * Generate a plain-English lease summary for a tenant.
 * Body: { tenantId: string }
 */
router.post('/lease-summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'tenantId is required');
    }

    const result = await generateLeaseSummary(tenantId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/renewal-risk
 * Generate a renewal risk assessment for a tenant with an expiring lease.
 * Body: { tenantId: string }
 */
router.post('/renewal-risk', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'tenantId is required');
    }

    const result = await generateRenewalRisk(tenantId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/document-insights
 * Generate AI insights (summary + risk flags) for a document.
 * Body: { documentId: string }
 */
router.post('/document-insights', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentId } = req.body;

    if (!documentId || typeof documentId !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'documentId is required');
    }

    const result = await generateDocumentInsights(documentId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;

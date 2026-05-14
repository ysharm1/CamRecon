import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { AppError } from '../middleware';
import { abstractionService } from './abstraction.service';
import type { LeaseAbstractionRecord, ExtractedTerm } from './abstraction.types';
import db from '../db';

const router = Router();

/**
 * Map a DB-shaped abstraction record to the camelCase API shape the frontend
 * expects. Also joins document + property + tenant context.
 */
async function toAbstractionApi(record: LeaseAbstractionRecord) {
  const doc = await db('documents')
    .leftJoin('properties', 'documents.property_id', 'properties.id')
    .leftJoin('tenants', 'documents.tenant_id', 'tenants.id')
    .select(
      'documents.id as document_id',
      'documents.title as document_title',
      'properties.name as property_name',
      'tenants.name as tenant_name',
    )
    .where('documents.id', record.document_id)
    .first();

  const extractedTerms = Array.isArray(record.extracted_terms) ? record.extracted_terms : [];

  return {
    id: record.id,
    documentId: record.document_id,
    documentTitle: doc?.document_title,
    propertyName: doc?.property_name,
    tenantName: doc?.tenant_name,
    status: record.review_status,
    confidenceScore: Number(record.confidence_score ?? 0),
    extractedTerms: extractedTerms.map((t: ExtractedTerm) => ({
      // Keep both snake_case field and camelCase-friendly alias for robustness.
      field: t.fieldName,
      value: t.value,
      confidence: Number(t.confidence ?? 0),
      sourceText: t.sourceText,
      sourcePageNumber: t.sourcePageNumber,
    })),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

/**
 * GET /api/abstractions/pending
 * List all abstractions with review_status='pending'.
 */
router.get(
  '/pending',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await abstractionService.listPendingAbstractions();
      const mapped = await Promise.all(results.map(toAbstractionApi));
      res.json({ data: mapped });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/abstractions/:id/approve
 * Approve an abstraction (sets review_status='approved').
 */
router.put(
  '/:id/approve',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await abstractionService.approveAbstraction(id);
      res.json({ data: await toAbstractionApi(result) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/abstractions/:id/correct
 * Correct extracted terms and approve (body: { corrections: [{fieldName, newValue}] }).
 */
router.put(
  '/:id/correct',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { corrections } = req.body;

      if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'corrections array is required and must not be empty');
      }

      for (const correction of corrections) {
        if (!correction.fieldName || typeof correction.fieldName !== 'string') {
          throw new AppError(400, 'VALIDATION_ERROR', 'Each correction must have a fieldName string');
        }
        if (correction.newValue === undefined || correction.newValue === null) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Each correction must have a newValue');
        }
      }

      const result = await abstractionService.correctAbstraction(id, corrections);
      res.json({ data: await toAbstractionApi(result) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/abstractions/:id/reject
 * Reject an abstraction (sets review_status='needs_correction').
 */
router.put(
  '/:id/reject',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await abstractionService.rejectAbstraction(id);
      res.json({ data: await toAbstractionApi(result) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/abstractions/:documentId/process
 * Trigger AI abstraction processing for a document.
 */
router.post(
  '/:documentId/process',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId } = req.params;

      if (!documentId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'documentId is required');
      }

      const result = await abstractionService.processAbstraction(
        documentId,
        req.user!.userId
      );

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/abstractions/:documentId
 * Get abstraction results for a document.
 */
router.get(
  '/:documentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId } = req.params;

      if (!documentId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'documentId is required');
      }

      const result = await abstractionService.getAbstraction(documentId);

      if (!result) {
        throw new AppError(
          404,
          'ABSTRACTION_NOT_FOUND',
          `No abstraction results found for document '${documentId}'`
        );
      }

      res.json({ data: await toAbstractionApi(result) });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

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
 * POST /api/abstractions/:documentId/summarize
 * Generate an AI summary of the lease abstraction for a document.
 * Returns cached summary if available, otherwise generates a new one.
 */
router.post(
  '/:documentId/summarize',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId } = req.params;

      if (!documentId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'documentId is required');
      }

      // Get the abstraction for this document
      const abstraction = await abstractionService.getAbstraction(documentId);
      if (!abstraction) {
        throw new AppError(
          404,
          'ABSTRACTION_NOT_FOUND',
          `No abstraction results found for document '${documentId}'`
        );
      }

      // Check if we have a cached summary stored in extracted_terms metadata
      const extractedTermsRaw = Array.isArray(abstraction.extracted_terms) ? abstraction.extracted_terms : [];
      const cachedSummaryTerm = extractedTermsRaw.find((t: ExtractedTerm) => t.fieldName === '__ai_summary');
      if (cachedSummaryTerm) {
        res.json({ data: { summary: cachedSummaryTerm.value, source: (cachedSummaryTerm.sourceText as string) === 'ai' ? 'ai' : 'template', cached: true } });
        return;
      }

      // Generate summary from extracted terms
      const extractedTerms = extractedTermsRaw.filter((t: ExtractedTerm) => !t.fieldName.startsWith('__'));
      const termsMap: Record<string, string> = {};
      for (const term of extractedTerms) {
        termsMap[term.fieldName] = term.value;
      }

      let summary: string;
      let source: 'ai' | 'template' = 'template';

      // Try AI if OpenAI key is configured
      if (process.env.OPENAI_API_KEY) {
        try {
          const { default: OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          const termsStr = extractedTerms.map((t: ExtractedTerm) => `${t.fieldName}: ${t.value}`).join('\n');
          const prompt = `Summarize this commercial lease in 2-3 concise sentences for a property manager. Include term length, rent, escalation, CAM cap, renewal options, and any notable provisions.\n\nExtracted Terms:\n${termsStr}\n\nProvide a professional, concise summary.`;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.3,
          });

          const aiSummary = response.choices[0]?.message?.content?.trim();
          if (aiSummary) {
            summary = aiSummary;
            source = 'ai';
          } else {
            summary = buildTemplateSummary(termsMap);
          }
        } catch {
          summary = buildTemplateSummary(termsMap);
        }
      } else {
        summary = buildTemplateSummary(termsMap);
      }

      // Cache the summary by appending a special term to extracted_terms
      const updatedTerms = [...extractedTermsRaw.filter((t: ExtractedTerm) => t.fieldName !== '__ai_summary'), { fieldName: '__ai_summary', value: summary, confidence: 1, sourcePageNumber: 0, sourceText: source }];
      await db('lease_abstractions')
        .where({ id: abstraction.id })
        .update({ extracted_terms: JSON.stringify(updatedTerms) })
        .catch(() => { /* ignore cache write failures */ });

      res.json({ data: { summary, source, cached: false } });
    } catch (error) {
      next(error);
    }
  }
);

function buildTemplateSummary(terms: Record<string, string>): string {
  const commencement = terms['commencement_date'] || 'N/A';
  const expiration = terms['expiration_date'] || 'N/A';
  const baseRent = terms['base_rent'] || 'N/A';
  const camCap = terms['cam_cap'] || null;
  const escalation = terms['rent_escalation'] || null;
  const renewalOption = terms['renewal_option'] || terms['renewal_options'] || null;

  let summary = `Lease from ${commencement} to ${expiration}. Base rent: $${baseRent}/mo.`;
  if (escalation) {
    summary += ` Escalation: ${escalation}.`;
  }
  if (camCap) {
    summary += ` CAM cap: $${camCap}/mo.`;
  }
  if (renewalOption) {
    summary += ` Renewal: ${renewalOption}.`;
  }
  return summary;
}

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

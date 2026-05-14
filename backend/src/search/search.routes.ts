import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth';
import { AppError } from '../middleware';
import { searchService } from './search.service';
import { SearchQuery } from './search.types';

const router = Router();

/**
 * Zod schema for search query parameters validation.
 */
const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query must not be empty'),
  propertyId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  documentType: z.enum(['lease', 'invoice', 'report', 'correspondence']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, 'page must be at least 1')),
  pageSize: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, 'pageSize must be at least 1').max(100, 'pageSize must not exceed 100')),
});

/**
 * GET /api/search
 * Search documents with full-text query and optional faceted filters.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = searchQuerySchema.parse(req.query);

    const searchQuery: SearchQuery = {
      textQuery: parsed.q,
      propertyId: parsed.propertyId,
      tenantId: parsed.tenantId,
      documentType: parsed.documentType,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };

    const response = await searchService.search(searchQuery);

    res.json({ data: response });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Check if the error is specifically about empty query
      const qError = error.issues.find((issue) => issue.path.includes('q'));
      if (qError) {
        return next(new AppError(400, 'VALIDATION_ERROR', 'Search query must not be empty'));
      }
    }
    next(error);
  }
});

export default router;

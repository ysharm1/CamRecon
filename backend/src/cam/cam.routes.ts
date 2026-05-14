/**
 * CAM Reconciliation Routes
 *
 * POST /api/reconciliations       — Initiate a new reconciliation
 * POST /api/reconciliations/what-if — Run a what-if simulation (no persistence)
 * POST /api/reconciliations/:id/explain — Generate variance explanations
 * GET  /api/reconciliations/:id   — Get reconciliation result with allocations
 * GET  /api/reconciliations       — List reconciliations for a property (query: propertyId)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import { camService } from './cam.service';
import { whatIfReconcile } from './cam.engine';
import { generateVarianceExplanation } from './cam.explain';
import type { CAMLineItem, TenantLease, WhatIfOptions, AllocationMethod } from './cam.types';

const router = Router();

const VALID_ALLOCATION_METHODS: AllocationMethod[] = [
  'pro_rata',
  'fixed_percentage',
  'base_year_stop',
  'modified_gross',
];

/**
 * POST /api/reconciliations/what-if
 * Run a what-if simulation without persisting results.
 *
 * Body: {
 *   propertyId, totalLeasableArea, periodStart, periodEnd,
 *   lineItems: [{ category, description, amountCents }],
 *   tenants: [{ tenantId, squareFootage, estimatedCAMCents, camCapCents?, fixedPercentage?, baseYearAmountCents? }],
 *   options: { allocationMethod, grossUpEnabled, targetOccupancy, exclusions }
 * }
 */
router.post('/what-if', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, totalLeasableArea, periodStart, periodEnd, lineItems, tenants, options } = req.body;

    // Validate required fields
    if (!propertyId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'propertyId is required');
    }
    if (!totalLeasableArea || typeof totalLeasableArea !== 'number' || totalLeasableArea <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'totalLeasableArea must be a positive number');
    }
    if (!periodStart) {
      throw new AppError(400, 'VALIDATION_ERROR', 'periodStart is required');
    }
    if (!periodEnd) {
      throw new AppError(400, 'VALIDATION_ERROR', 'periodEnd is required');
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'lineItems must be a non-empty array');
    }
    if (!tenants || !Array.isArray(tenants) || tenants.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'tenants must be a non-empty array');
    }

    // Validate options
    const whatIfOptions: WhatIfOptions = {
      allocationMethod: options?.allocationMethod || 'pro_rata',
      grossUpEnabled: options?.grossUpEnabled ?? false,
      targetOccupancy: options?.targetOccupancy ?? 0.95,
      exclusions: options?.exclusions || [],
    };

    if (!VALID_ALLOCATION_METHODS.includes(whatIfOptions.allocationMethod)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `allocationMethod must be one of: ${VALID_ALLOCATION_METHODS.join(', ')}`
      );
    }

    if (whatIfOptions.targetOccupancy <= 0 || whatIfOptions.targetOccupancy > 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'targetOccupancy must be between 0 and 1');
    }

    // Validate line items
    const engineLineItems: CAMLineItem[] = lineItems.map((item: Record<string, unknown>, i: number) => {
      if (!item.category) {
        throw new AppError(400, 'VALIDATION_ERROR', `lineItems[${i}].category is required`);
      }
      if (typeof item.amountCents !== 'number' || (item.amountCents as number) <= 0) {
        throw new AppError(400, 'VALIDATION_ERROR', `lineItems[${i}].amountCents must be a positive number`);
      }
      return {
        category: item.category as string,
        description: (item.description as string) || '',
        amountCents: item.amountCents as number,
      };
    });

    // Validate tenants
    const engineTenants: TenantLease[] = tenants.map((t: Record<string, unknown>, i: number) => {
      if (!t.tenantId) {
        throw new AppError(400, 'VALIDATION_ERROR', `tenants[${i}].tenantId is required`);
      }
      if (typeof t.squareFootage !== 'number' || (t.squareFootage as number) <= 0) {
        throw new AppError(400, 'VALIDATION_ERROR', `tenants[${i}].squareFootage must be a positive number`);
      }
      return {
        tenantId: t.tenantId as string,
        squareFootage: t.squareFootage as number,
        estimatedCAMCents: (t.estimatedCAMCents as number) || 0,
        camCapCents: t.camCapCents as number | undefined,
        fixedPercentage: t.fixedPercentage as number | undefined,
        baseYearAmountCents: t.baseYearAmountCents as number | undefined,
        excludedCategories: t.excludedCategories as string[] | undefined,
      };
    });

    // Run what-if simulation (never persists)
    const result = whatIfReconcile(
      { propertyId, totalLeasableArea, periodStart, periodEnd },
      engineLineItems,
      engineTenants,
      whatIfOptions
    );

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reconciliations/:id/explain
 * Generate variance explanations for a completed reconciliation.
 */
router.post('/:id/explain', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const explanations = await generateVarianceExplanation(id);
    res.json({ data: explanations });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reconciliations
 * Initiate a new CAM reconciliation.
 *
 * Body: { propertyId, periodStart, periodEnd, lineItems: [{ category, description, amountCents }] }
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, periodStart, periodEnd, lineItems } = req.body;

    // Validate required fields
    if (!propertyId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'propertyId is required');
    }
    if (!periodStart) {
      throw new AppError(400, 'VALIDATION_ERROR', 'periodStart is required');
    }
    if (!periodEnd) {
      throw new AppError(400, 'VALIDATION_ERROR', 'periodEnd is required');
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'lineItems must be a non-empty array');
    }

    // Validate each line item
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.category) {
        throw new AppError(400, 'VALIDATION_ERROR', `lineItems[${i}].category is required`);
      }
      if (!item.description) {
        throw new AppError(400, 'VALIDATION_ERROR', `lineItems[${i}].description is required`);
      }
      if (typeof item.amountCents !== 'number' || item.amountCents <= 0) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `lineItems[${i}].amountCents must be a positive number`
        );
      }
    }

    // Validate period dates
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    if (isNaN(startDate.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'periodStart must be a valid date');
    }
    if (isNaN(endDate.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'periodEnd must be a valid date');
    }
    if (endDate <= startDate) {
      throw new AppError(400, 'VALIDATION_ERROR', 'periodEnd must be after periodStart');
    }

    const result = await camService.initiateReconciliation(
      { propertyId, periodStart, periodEnd, lineItems },
      req.user!.userId
    );

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reconciliations/:id
 * Get a reconciliation result with line items and allocations.
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await camService.getReconciliation(req.params.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reconciliations
 * List reconciliations for a property.
 * Query: propertyId (required)
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId } = req.query;

    if (!propertyId || typeof propertyId !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'propertyId query parameter is required');
    }

    const results = await camService.listReconciliations(propertyId);
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

export default router;

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
import { camService, ReconciliationRecord } from './cam.service';
import { whatIfReconcile } from './cam.engine';
import { generateVarianceExplanation } from './cam.explain';
import type { CAMLineItem, TenantLease, WhatIfOptions, AllocationMethod } from './cam.types';
import db from '../db';

const router = Router();

/**
 * Generate a professional CAM reconciliation letter.
 * Uses OpenAI if configured, otherwise falls back to a template.
 */
async function generateCAMDraftLetter(reconciliation: ReconciliationRecord): Promise<string> {
  // Fetch property name
  const property = await db('properties').where({ id: reconciliation.propertyId }).select('name').first();
  const propertyName = property?.name || 'the property';
  const periodStart = reconciliation.periodStart;
  const periodEnd = reconciliation.periodEnd;
  const totalActualCosts = reconciliation.totalExpensesCents;

  // Fetch tenant names for allocations
  const allocations = reconciliation.allocations || [];
  const tenantIds = allocations.map(a => a.tenantId);
  const tenants = tenantIds.length > 0
    ? await db('tenants').whereIn('id', tenantIds).select('id', 'name')
    : [];
  const tenantNameMap: Record<string, string> = {};
  for (const t of tenants) {
    tenantNameMap[t.id] = t.name;
  }

  const tenantAllocations = allocations.map(a => ({
    tenantName: tenantNameMap[a.tenantId] || a.tenantId,
    squareFootage: a.squareFootage,
    sharePercentage: a.sharePercentage,
    allocatedAmount: a.actualAmountCents,
    budgetedAmount: a.estimatedAmountCents,
    variance: a.varianceCents,
  }));

  const totalFormatted = (totalActualCosts / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // Try AI generation
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const allocSummary = tenantAllocations.map(a =>
        `- ${a.tenantName}: ${(a.sharePercentage * 100).toFixed(2)}% share, allocated ${(a.allocatedAmount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}, variance ${a.variance >= 0 ? '+' : ''}${(a.variance / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
      ).join('\n');

      const prompt = `Draft a professional CAM (Common Area Maintenance) reconciliation letter for a commercial property. The letter should be addressed to all tenants of the property.

Property: ${propertyName}
Reconciliation Period: ${periodStart} to ${periodEnd}
Total CAM Expenses: ${totalFormatted}

Tenant Allocations:
${allocSummary}

The letter should:
1. Be professional and concise
2. Explain the reconciliation period and total expenses
3. Note that each tenant's share is based on their pro-rata square footage
4. Mention that individual statements are attached
5. Include payment instructions for any amounts owed (net 30 days)
6. Provide contact information placeholder for questions

Format as a business letter without addresses (those will be added separately).`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      });

      const aiLetter = response.choices[0]?.message?.content?.trim();
      if (aiLetter) return aiLetter;
    } catch { /* fall through to template */ }
  }

  // Template-based fallback
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  let letter = `${today}\n\n`;
  letter += `RE: Common Area Maintenance (CAM) Reconciliation\n`;
  letter += `Property: ${propertyName}\n`;
  letter += `Period: ${periodStart} to ${periodEnd}\n\n`;
  letter += `Dear Tenants,\n\n`;
  letter += `We have completed the annual Common Area Maintenance (CAM) reconciliation for ${propertyName} for the period ${periodStart} through ${periodEnd}.\n\n`;
  letter += `The total actual CAM expenses for this period were ${totalFormatted}. Each tenant's share has been calculated based on their pro-rata square footage allocation as specified in their respective lease agreements.\n\n`;
  letter += `Summary of Allocations:\n\n`;

  for (const alloc of tenantAllocations) {
    const allocated = (alloc.allocatedAmount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const varianceAbs = Math.abs(alloc.variance);
    const varianceFormatted = (varianceAbs / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const varianceLabel = alloc.variance > 0 ? `(underpaid by ${varianceFormatted})` : alloc.variance < 0 ? `(overpaid by ${varianceFormatted})` : '(no variance)';
    letter += `  • ${alloc.tenantName}: ${(alloc.sharePercentage * 100).toFixed(2)}% share — ${allocated} ${varianceLabel}\n`;
  }

  letter += `\nIndividual tenant statements with detailed line-item breakdowns are attached to this letter.\n\n`;
  letter += `For tenants with a positive variance (amount owed), payment is due within 30 days of receipt of this notice. Please remit payment to:\n\n`;
  letter += `  [Property Management Company]\n`;
  letter += `  [Address]\n`;
  letter += `  Reference: CAM Reconciliation ${periodStart}-${periodEnd}\n\n`;
  letter += `For tenants with a negative variance (credit), the overpayment will be applied to your next monthly CAM charge.\n\n`;
  letter += `If you have any questions regarding this reconciliation, please contact our office at [phone] or [email].\n\n`;
  letter += `Sincerely,\n\n`;
  letter += `[Property Manager Name]\n`;
  letter += `[Property Management Company]`;

  return letter;
}

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
 * POST /api/reconciliations/:id/draft-letter
 * Generate a professional CAM reconciliation letter addressed to tenants.
 */
router.post('/:id/draft-letter', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Fetch reconciliation with property and tenant data
    const reconciliation = await camService.getReconciliation(id);
    if (!reconciliation) {
      throw new AppError(404, 'NOT_FOUND', `Reconciliation ${id} not found`);
    }

    const letter = await generateCAMDraftLetter(reconciliation);
    res.json({ data: { letter, format: 'text' } });
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

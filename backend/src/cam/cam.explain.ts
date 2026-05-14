/**
 * CAM Variance Explanation Service
 *
 * Generates plain-English explanations for tenant allocation variances
 * using LLM when available, falling back to template-based explanations.
 */

import db from '../db';
import { AppError } from '../middleware/errorHandler';
import type { VarianceExplanation } from './cam.types';

/** Threshold for "significant" variance that warrants explanation (10%) */
const SIGNIFICANT_VARIANCE_THRESHOLD = 0.10;

interface AllocationRow {
  tenant_id: string;
  square_footage: number;
  share_percentage: number;
  estimated_amount_cents: number;
  actual_amount_cents: number;
  variance_cents: number;
}

interface LineItemRow {
  category: string;
  description: string;
  amount_cents: number;
}

interface TenantRow {
  id: string;
  name: string;
}

/**
 * Generate template-based variance explanation when no LLM is configured.
 */
function generateTemplateExplanation(
  tenantName: string,
  allocation: AllocationRow,
  variancePercentage: number,
  _lineItems: LineItemRow[]
): string {
  const direction = allocation.variance_cents > 0 ? 'increased' : 'decreased';
  const absVariance = Math.abs(allocation.variance_cents);
  const absPercentage = Math.abs(variancePercentage * 100).toFixed(1);
  const actualDollars = (allocation.actual_amount_cents / 100).toFixed(2);
  const estimatedDollars = (allocation.estimated_amount_cents / 100).toFixed(2);

  let explanation = `${tenantName}'s CAM charges ${direction} by $${(absVariance / 100).toFixed(2)} (${absPercentage}%). `;
  explanation += `Their actual allocation is $${actualDollars} compared to the estimated $${estimatedDollars}. `;
  explanation += `This tenant occupies ${allocation.square_footage.toLocaleString()} sq ft `;
  explanation += `with a ${(allocation.share_percentage * 100).toFixed(2)}% pro-rata share. `;

  if (allocation.variance_cents > 0) {
    explanation += `The increase is likely due to higher-than-budgeted operating expenses for the period.`;
  } else {
    explanation += `The decrease is likely due to lower-than-budgeted operating expenses for the period.`;
  }

  return explanation;
}

/**
 * Attempt to generate LLM-based explanation using OpenAI or Anthropic.
 * Returns null if no LLM is configured or the call fails.
 */
async function generateLLMExplanation(
  tenantName: string,
  allocation: AllocationRow,
  variancePercentage: number,
  lineItems: LineItemRow[]
): Promise<string | null> {
  // Check if OpenAI is configured
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return null;
  }

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: openaiKey });

    const direction = allocation.variance_cents > 0 ? 'increased' : 'decreased';
    const lineItemSummary = lineItems
      .map((li) => `${li.category}: $${(li.amount_cents / 100).toFixed(2)}`)
      .join(', ');

    const prompt = `You are a property management financial analyst. Explain in 2-3 plain English sentences why a tenant's CAM charges changed.

Tenant: ${tenantName}
Square Footage: ${allocation.square_footage.toLocaleString()} sq ft
Pro-Rata Share: ${(allocation.share_percentage * 100).toFixed(2)}%
Estimated CAM: $${(allocation.estimated_amount_cents / 100).toFixed(2)}
Actual CAM: $${(allocation.actual_amount_cents / 100).toFixed(2)}
Variance: ${direction} by $${(Math.abs(allocation.variance_cents) / 100).toFixed(2)} (${(Math.abs(variancePercentage) * 100).toFixed(1)}%)
Expense Categories: ${lineItemSummary}

Provide a concise, professional explanation suitable for a tenant statement.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch {
    // LLM call failed, will fall back to template
    return null;
  }
}

/**
 * Generate variance explanations for all tenants with significant variance
 * in a completed reconciliation.
 *
 * @param reconciliationId - The ID of the reconciliation to explain
 * @returns Array of variance explanations for tenants with >10% variance
 */
export async function generateVarianceExplanation(
  reconciliationId: string
): Promise<VarianceExplanation[]> {
  // 1. Fetch reconciliation record
  const reconciliation = await db('cam_reconciliations')
    .where({ id: reconciliationId })
    .first();

  if (!reconciliation) {
    throw new AppError(404, 'RECONCILIATION_NOT_FOUND', `Reconciliation ${reconciliationId} not found`);
  }

  // 2. Fetch allocations
  const allocations: AllocationRow[] = await db('tenant_allocations')
    .where({ reconciliation_id: reconciliationId })
    .select('*');

  if (allocations.length === 0) {
    return [];
  }

  // 3. Fetch line items for context
  const lineItems: LineItemRow[] = await db('cam_line_items')
    .where({ reconciliation_id: reconciliationId })
    .select('*');

  // 4. Fetch tenant names
  const tenantIds = allocations.map((a) => a.tenant_id);
  const tenants: TenantRow[] = await db('tenants')
    .whereIn('id', tenantIds)
    .select('id', 'name');
  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  // 5. Filter to tenants with significant variance (>10%)
  const explanations: VarianceExplanation[] = [];

  for (const allocation of allocations) {
    const estimatedAmount = allocation.estimated_amount_cents;
    if (estimatedAmount === 0) continue;

    const variancePercentage = allocation.variance_cents / estimatedAmount;

    if (Math.abs(variancePercentage) <= SIGNIFICANT_VARIANCE_THRESHOLD) {
      continue;
    }

    const tenantName = tenantMap.get(allocation.tenant_id) || 'Unknown Tenant';

    // Try LLM first, fall back to template
    let explanation = await generateLLMExplanation(
      tenantName,
      allocation,
      variancePercentage,
      lineItems
    );

    if (!explanation) {
      explanation = generateTemplateExplanation(
        tenantName,
        allocation,
        variancePercentage,
        lineItems
      );
    }

    explanations.push({
      tenantId: allocation.tenant_id,
      explanation,
      variancePercentage: Math.round(variancePercentage * 100) / 100,
    });
  }

  // 6. Store explanations in the database (update tenant_allocations with explanation)
  for (const exp of explanations) {
    await db('tenant_allocations')
      .where({ reconciliation_id: reconciliationId, tenant_id: exp.tenantId })
      .update({ explanation: exp.explanation });
  }

  return explanations;
}

/**
 * AI Service
 *
 * Shared logic for calling OpenAI GPT-4o-mini with graceful fallback
 * to template-based responses when no API key is configured.
 */

import db from '../db';
import { AppError } from '../middleware/errorHandler';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeaseSummaryResult {
  summary: string;
  source: 'ai' | 'template';
}

export interface RenewalRiskResult {
  tenantId: string;
  tenantName: string;
  riskAssessment: string;
  daysUntilExpiration: number;
  source: 'ai' | 'template';
}

export interface DocumentInsightsResult {
  summary: string;
  risks: string[];
  source: 'ai' | 'template';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

async function callOpenAI(prompt: string, maxTokens = 300): Promise<string | null> {
  if (!isOpenAIConfigured()) return null;

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// ─── Lease Summary ───────────────────────────────────────────────────────────

interface LeaseRow {
  commencement_date: string;
  expiration_date: string;
  base_rent_cents: number;
  rent_escalation: string | null;
  cam_cap_cents: number | null;
  security_deposit_cents: number | null;
  extracted_terms: string;
  confidence_score: number;
}

interface TenantRow {
  name: string;
  suite_number: string;
  square_footage: number;
}

function generateTemplateLeaseSummary(tenant: TenantRow, lease: LeaseRow): string {
  const start = new Date(lease.commencement_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const end = new Date(lease.expiration_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const rent = (lease.base_rent_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  let escalation = '';
  if (lease.rent_escalation) {
    try {
      const esc = typeof lease.rent_escalation === 'string' ? JSON.parse(lease.rent_escalation) : lease.rent_escalation;
      if (esc && esc.rate) {
        escalation = ` with ${esc.rate}% annual escalation`;
      }
    } catch { /* ignore */ }
  }

  const camCap = lease.cam_cap_cents
    ? ` CAM is capped at ${(lease.cam_cap_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}/mo.`
    : '';

  return `${tenant.name} leases ${tenant.square_footage.toLocaleString()} sqft (Suite ${tenant.suite_number}) from ${start} to ${end}. Base rent is ${rent}/mo${escalation}.${camCap}`;
}

export async function generateLeaseSummary(tenantId: string): Promise<LeaseSummaryResult> {
  // Fetch tenant
  const tenant: TenantRow | undefined = await db('tenants')
    .where({ id: tenantId })
    .select('name', 'suite_number', 'square_footage')
    .first();

  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
  }

  // Fetch lease abstraction
  const lease: LeaseRow | undefined = await db('lease_abstractions')
    .where({ tenant_id: tenantId })
    .orderBy('created_at', 'desc')
    .first();

  if (!lease) {
    throw new AppError(404, 'LEASE_NOT_FOUND', `No lease abstraction found for tenant ${tenantId}`);
  }

  // Try AI first
  const rent = (lease.base_rent_cents / 100).toFixed(2);
  const camCap = lease.cam_cap_cents ? `$${(lease.cam_cap_cents / 100).toFixed(2)}/mo` : 'None';

  let escalationStr = 'None specified';
  if (lease.rent_escalation) {
    try {
      const esc = typeof lease.rent_escalation === 'string' ? JSON.parse(lease.rent_escalation) : lease.rent_escalation;
      if (esc && esc.rate) {
        escalationStr = `${esc.rate}% ${esc.type || 'annual'}`;
      }
    } catch { /* ignore */ }
  }

  const prompt = `Summarize this commercial lease in 2-3 sentences for a property manager. Include: term length, rent, escalation, CAM cap, and any notable provisions.

Tenant: ${tenant.name}
Suite: ${tenant.suite_number}
Square Footage: ${tenant.square_footage.toLocaleString()} sqft
Commencement: ${lease.commencement_date}
Expiration: ${lease.expiration_date}
Base Rent: $${rent}/month
Rent Escalation: ${escalationStr}
CAM Cap: ${camCap}
Security Deposit: $${(lease.security_deposit_cents || 0) / 100}

Provide a concise, professional summary.`;

  const aiSummary = await callOpenAI(prompt, 200);

  if (aiSummary) {
    return { summary: aiSummary, source: 'ai' };
  }

  return { summary: generateTemplateLeaseSummary(tenant, lease), source: 'template' };
}

// ─── Renewal Risk ────────────────────────────────────────────────────────────

interface LeaseExpirationRow {
  tenant_id: string;
  tenant_name: string;
  expiration_date: string;
  commencement_date: string;
  renewal_options: string | null;
  base_rent_cents: number;
  square_footage: number;
}

function generateTemplateRenewalRisk(lease: LeaseExpirationRow, daysUntilExpiration: number): string {
  // Assume a standard 180-day notice period for commercial leases
  const noticePeriodDays = 180;
  const missedNotice = daysUntilExpiration < noticePeriodDays;

  let assessment = `${lease.tenant_name}'s lease expires in ${daysUntilExpiration} days (${new Date(lease.expiration_date).toLocaleDateString()}).`;

  if (missedNotice) {
    assessment += ` Standard ${noticePeriodDays}-day notice period has passed — consider reaching out immediately to discuss holdover terms or renewal.`;
  } else {
    assessment += ` Still within the typical ${noticePeriodDays}-day notice window. Proactive outreach recommended.`;
  }

  return assessment;
}

export async function generateRenewalRisk(tenantId: string): Promise<RenewalRiskResult> {
  const lease: LeaseExpirationRow | undefined = await db('lease_abstractions as la')
    .join('tenants as t', 'la.tenant_id', 't.id')
    .where('la.tenant_id', tenantId)
    .orderBy('la.created_at', 'desc')
    .select(
      'la.tenant_id',
      't.name as tenant_name',
      'la.expiration_date',
      'la.commencement_date',
      'la.renewal_options',
      'la.base_rent_cents',
      't.square_footage'
    )
    .first();

  if (!lease) {
    throw new AppError(404, 'LEASE_NOT_FOUND', `No lease found for tenant ${tenantId}`);
  }

  const now = new Date();
  const expiration = new Date(lease.expiration_date);
  const daysUntilExpiration = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let renewalOptions = 'None specified';
  if (lease.renewal_options) {
    try {
      const opts = typeof lease.renewal_options === 'string' ? JSON.parse(lease.renewal_options) : lease.renewal_options;
      if (Array.isArray(opts) && opts.length > 0) {
        renewalOptions = opts.join('; ');
      }
    } catch { /* ignore */ }
  }

  const prompt = `You are a property management risk analyst. Provide a 1-2 sentence risk assessment for this expiring lease.

Tenant: ${lease.tenant_name}
Lease Expiration: ${lease.expiration_date} (${daysUntilExpiration} days from now)
Lease Start: ${lease.commencement_date}
Monthly Rent: $${(lease.base_rent_cents / 100).toFixed(2)}
Space: ${lease.square_footage.toLocaleString()} sqft
Renewal Options: ${renewalOptions}

Consider: Has the typical 180-day notice period passed? What's the risk level? What action should the property manager take?`;

  const aiAssessment = await callOpenAI(prompt, 150);

  if (aiAssessment) {
    return {
      tenantId,
      tenantName: lease.tenant_name,
      riskAssessment: aiAssessment,
      daysUntilExpiration,
      source: 'ai',
    };
  }

  return {
    tenantId,
    tenantName: lease.tenant_name,
    riskAssessment: generateTemplateRenewalRisk(lease, daysUntilExpiration),
    daysUntilExpiration,
    source: 'template',
  };
}

// ─── Document Insights ───────────────────────────────────────────────────────

interface DocumentRow {
  id: string;
  title: string;
  document_type: string;
  tenant_id: string | null;
}

interface AbstractionRow {
  expiration_date: string;
  commencement_date: string;
  base_rent_cents: number;
  cam_cap_cents: number | null;
  extracted_terms: string;
  confidence_score: number;
}

function generateTemplateDocumentInsights(
  doc: DocumentRow,
  abstraction: AbstractionRow
): DocumentInsightsResult {
  const now = new Date();
  const expiration = new Date(abstraction.expiration_date);
  const daysUntilExpiration = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const start = new Date(abstraction.commencement_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const end = new Date(abstraction.expiration_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const rent = (abstraction.base_rent_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const summary = `${doc.document_type.replace('_', ' ')} covering ${start} to ${end} with base rent of ${rent}/mo.`;

  const risks: string[] = [];

  if (daysUntilExpiration <= 90 && daysUntilExpiration > 0) {
    risks.push(`Lease expires within ${daysUntilExpiration} days`);
  } else if (daysUntilExpiration <= 0) {
    risks.push('Lease has expired');
  }

  if (!abstraction.cam_cap_cents) {
    risks.push('No CAM cap specified — tenant exposed to unlimited expense increases');
  }

  // Check for low confidence extraction
  if (abstraction.confidence_score < 0.7) {
    risks.push('Low extraction confidence — manual review recommended');
  }

  // Parse extracted terms to check for missing clauses
  let terms: Array<{ fieldName: string }> = [];
  try {
    terms = typeof abstraction.extracted_terms === 'string'
      ? JSON.parse(abstraction.extracted_terms)
      : abstraction.extracted_terms;
  } catch { /* ignore */ }

  const termFields = terms.map((t) => t.fieldName);
  if (!termFields.includes('renewal_option')) {
    risks.push('No renewal option clause found');
  }
  if (!termFields.includes('termination_clause') && !termFields.includes('early_termination')) {
    risks.push('No early termination clause found');
  }

  return { summary, risks, source: 'template' };
}

export async function generateDocumentInsights(documentId: string): Promise<DocumentInsightsResult> {
  const doc: DocumentRow | undefined = await db('documents')
    .where({ id: documentId })
    .select('id', 'title', 'document_type', 'tenant_id')
    .first();

  if (!doc) {
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', `Document ${documentId} not found`);
  }

  const abstraction: AbstractionRow | undefined = await db('lease_abstractions')
    .where({ document_id: documentId })
    .orderBy('created_at', 'desc')
    .first();

  if (!abstraction) {
    throw new AppError(404, 'ABSTRACTION_NOT_FOUND', `No abstraction data found for document ${documentId}`);
  }

  // Parse extracted terms for the prompt
  let termsStr = '';
  try {
    const terms = typeof abstraction.extracted_terms === 'string'
      ? JSON.parse(abstraction.extracted_terms)
      : abstraction.extracted_terms;
    if (Array.isArray(terms)) {
      termsStr = terms.map((t: { fieldName: string; value: string }) => `${t.fieldName}: ${t.value}`).join('\n');
    }
  } catch { /* ignore */ }

  const prompt = `Based on these extracted lease terms, provide:
1. A one-sentence summary of the document
2. A list of risk flags a property manager should be aware of (e.g., missing clauses, below-market terms, upcoming deadlines)

Document: ${doc.title}
Type: ${doc.document_type}

Extracted Terms:
${termsStr}

Respond in JSON format: { "summary": "...", "risks": ["risk1", "risk2", ...] }
If there are no risks, return an empty array.`;

  const aiResponse = await callOpenAI(prompt, 300);

  if (aiResponse) {
    try {
      // Try to parse JSON from the AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary && Array.isArray(parsed.risks)) {
          return { summary: parsed.summary, risks: parsed.risks, source: 'ai' };
        }
      }
    } catch {
      // If JSON parsing fails, use the raw response as summary
      return { summary: aiResponse, risks: [], source: 'ai' };
    }
  }

  return generateTemplateDocumentInsights(doc, abstraction);
}

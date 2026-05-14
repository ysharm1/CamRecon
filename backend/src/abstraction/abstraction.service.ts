import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import db from '../db';
import { AppError } from '../middleware';
import { extractTerms } from './mock-extractor';
import { aiExtractTerms, isAIConfigured } from './ai-extractor';
import { llmExtractTerms, isLLMConfigured } from './llm-extractor';
import { parsePdf } from './pdf-parser';
import {
  AbstractionResult,
  ExtractedTerm,
  LeaseAbstractionRecord,
  REQUIRED_FIELDS,
  LOW_CONFIDENCE_THRESHOLD,
  MIN_TERMS_FOR_AUTO_APPROVAL,
} from './abstraction.types';

/**
 * Calculate overall confidence as the arithmetic mean of all term confidence scores.
 * Returns 0 if no terms are provided.
 */
export function calculateOverallConfidence(terms: ExtractedTerm[]): number {
  if (terms.length === 0) {
    return 0;
  }
  const sum = terms.reduce((acc, term) => acc + term.confidence, 0);
  return sum / terms.length;
}

/**
 * Determine if the abstraction result requires human review.
 * Returns true if:
 * - Any term has confidence below 0.60
 * - Fewer than 5 terms were extracted
 * - Required fields are missing from the extraction
 */
export function needsHumanReview(terms: ExtractedTerm[]): boolean {
  // Check if any term has low confidence
  const hasLowConfidence = terms.some(
    (term) => term.confidence < LOW_CONFIDENCE_THRESHOLD
  );
  if (hasLowConfidence) {
    return true;
  }

  // Check if fewer than minimum terms extracted
  if (terms.length < MIN_TERMS_FOR_AUTO_APPROVAL) {
    return true;
  }

  // Check if required fields are missing
  const extractedFieldNames = terms.map((term) => term.fieldName);
  const missingRequired = REQUIRED_FIELDS.some(
    (field) => !extractedFieldNames.includes(field)
  );
  if (missingRequired) {
    return true;
  }

  return false;
}

export interface Correction {
  fieldName: string;
  newValue: string;
}

export const abstractionService = {
  /**
   * Process abstraction for a document.
   * Extracts PDF text, runs AI extraction (or mock fallback), and stores results.
   * Uses LLM extractor with retry logic and token tracking when OPENAI_API_KEY is set.
   */
  async processAbstraction(documentId: string, userId: string): Promise<AbstractionResult> {
    // Fetch the document to get title and type
    const document = await db('documents').where('id', documentId).first();
    if (!document) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', `Document with id '${documentId}' not found`);
    }

    let extractedTerms: ExtractedTerm[];

    // Try to parse PDF and use LLM extraction (preferred) or AI extraction (fallback)
    if (document.file_path && (isLLMConfigured() || isAIConfigured())) {
      try {
        const filePath = path.resolve(document.file_path);
        const fileBuffer = fs.readFileSync(filePath);
        const pdfResult = await parsePdf(fileBuffer);

        if (isLLMConfigured()) {
          // Use LLM extractor with retry logic and token tracking
          const llmResult = await llmExtractTerms(pdfResult, document.title, document.document_type);
          extractedTerms = llmResult.terms;

          // Log token usage for cost monitoring
          if (llmResult.tokenUsage) {
            console.log(
              `[LLM Extraction] Document: ${documentId}, Provider: ${llmResult.provider}, ` +
              `Model: ${llmResult.model}, Tokens: ${llmResult.tokenUsage.totalTokens}, ` +
              `Cost: $${llmResult.tokenUsage.estimatedCostUsd.toFixed(6)}, ` +
              `Duration: ${llmResult.durationMs}ms`
            );
          }
        } else {
          // Fallback to ai-extractor (supports both OpenAI and Anthropic)
          extractedTerms = await aiExtractTerms(pdfResult, document.title, document.document_type);
        }
      } catch (error) {
        // If PDF parsing or AI fails, fall back to mock
        if (error instanceof AppError && (error.code === 'AI_EXTRACTION_ERROR' || error.code === 'LLM_EXTRACTION_ERROR')) {
          throw error;
        }
        extractedTerms = extractTerms(document.title, document.document_type);
      }
    } else {
      // No file path or no AI configured — use mock extractor
      extractedTerms = extractTerms(document.title, document.document_type);
    }

    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(extractedTerms);

    // Determine if review is needed
    const requiresReview = needsHumanReview(extractedTerms);

    // Extract specific fields for structured storage
    const getTermValue = (fieldName: string): string | undefined =>
      extractedTerms.find((t) => t.fieldName === fieldName)?.value;

    const commencementDate = getTermValue('commencement_date') || '2024-01-01';
    const expirationDate = getTermValue('expiration_date') || '2025-01-01';
    const baseRentStr = getTermValue('base_rent') || '0';
    const baseRentCents = Math.round(parseFloat(baseRentStr) * 100);
    const securityDepositStr = getTermValue('security_deposit') || '0';
    const securityDepositCents = Math.round(parseFloat(securityDepositStr) * 100);

    const camCapStr = getTermValue('cam_cap');
    const camCapCents = camCapStr ? Math.round(parseFloat(camCapStr) * 100) : null;

    const renewalOption = getTermValue('renewal_option');

    // Store results in the database
    const abstractionId = uuidv4();
    await db('lease_abstractions').insert({
      id: abstractionId,
      document_id: documentId,
      tenant_id: document.tenant_id || document.uploaded_by,
      commencement_date: commencementDate,
      expiration_date: expirationDate,
      base_rent_cents: baseRentCents,
      rent_escalation: JSON.stringify(null),
      cam_cap_cents: camCapCents,
      security_deposit_cents: securityDepositCents,
      renewal_options: JSON.stringify(renewalOption ? [renewalOption] : []),
      extracted_terms: JSON.stringify(extractedTerms),
      confidence_score: overallConfidence,
      review_status: requiresReview ? 'pending' : 'approved',
    });

    return {
      documentId,
      extractedTerms,
      overallConfidence,
      requiresReview,
    };
  },

  /**
   * Get abstraction results for a document.
   */
  async getAbstraction(documentId: string): Promise<LeaseAbstractionRecord | null> {
    const record = await db('lease_abstractions')
      .where('document_id', documentId)
      .orderBy('created_at', 'desc')
      .first();

    if (!record) {
      return null;
    }

    // Parse JSON fields
    return {
      ...record,
      extracted_terms:
        typeof record.extracted_terms === 'string'
          ? JSON.parse(record.extracted_terms)
          : record.extracted_terms,
      renewal_options:
        typeof record.renewal_options === 'string'
          ? JSON.parse(record.renewal_options)
          : record.renewal_options,
      rent_escalation:
        typeof record.rent_escalation === 'string'
          ? JSON.parse(record.rent_escalation)
          : record.rent_escalation,
    };
  },

  /**
   * List all abstractions with review_status='pending'.
   */
  async listPendingAbstractions(): Promise<LeaseAbstractionRecord[]> {
    const records = await db('lease_abstractions')
      .where('review_status', 'pending')
      .orderBy('created_at', 'desc');

    return records.map((record: any) => ({
      ...record,
      extracted_terms:
        typeof record.extracted_terms === 'string'
          ? JSON.parse(record.extracted_terms)
          : record.extracted_terms,
      renewal_options:
        typeof record.renewal_options === 'string'
          ? JSON.parse(record.renewal_options)
          : record.renewal_options,
      rent_escalation:
        typeof record.rent_escalation === 'string'
          ? JSON.parse(record.rent_escalation)
          : record.rent_escalation,
    }));
  },

  /**
   * Approve an abstraction (sets review_status='approved').
   */
  async approveAbstraction(id: string): Promise<LeaseAbstractionRecord> {
    const record = await db('lease_abstractions').where('id', id).first();
    if (!record) {
      throw new AppError(404, 'ABSTRACTION_NOT_FOUND', `Abstraction with id '${id}' not found`);
    }

    await db('lease_abstractions')
      .where('id', id)
      .update({ review_status: 'approved', updated_at: new Date().toISOString() });

    const updated = await db('lease_abstractions').where('id', id).first();
    return {
      ...updated,
      extracted_terms:
        typeof updated.extracted_terms === 'string'
          ? JSON.parse(updated.extracted_terms)
          : updated.extracted_terms,
      renewal_options:
        typeof updated.renewal_options === 'string'
          ? JSON.parse(updated.renewal_options)
          : updated.renewal_options,
      rent_escalation:
        typeof updated.rent_escalation === 'string'
          ? JSON.parse(updated.rent_escalation)
          : updated.rent_escalation,
    };
  },

  /**
   * Correct extracted terms and approve the abstraction.
   * Updates extracted_terms with corrections, recalculates confidence, sets review_status='approved'.
   */
  async correctAbstraction(id: string, corrections: Correction[]): Promise<LeaseAbstractionRecord> {
    const record = await db('lease_abstractions').where('id', id).first();
    if (!record) {
      throw new AppError(404, 'ABSTRACTION_NOT_FOUND', `Abstraction with id '${id}' not found`);
    }

    // Parse existing extracted terms
    const extractedTerms: ExtractedTerm[] =
      typeof record.extracted_terms === 'string'
        ? JSON.parse(record.extracted_terms)
        : record.extracted_terms;

    // Apply corrections
    for (const correction of corrections) {
      const term = extractedTerms.find((t) => t.fieldName === correction.fieldName);
      if (term) {
        term.value = correction.newValue;
        term.confidence = 1.0; // Manually corrected terms get full confidence
      } else {
        // Add new term if it doesn't exist
        extractedTerms.push({
          fieldName: correction.fieldName,
          value: correction.newValue,
          confidence: 1.0,
          sourcePageNumber: 0,
          sourceText: 'Manually corrected',
        });
      }
    }

    // Recalculate overall confidence
    const newConfidence = calculateOverallConfidence(extractedTerms);

    await db('lease_abstractions')
      .where('id', id)
      .update({
        extracted_terms: JSON.stringify(extractedTerms),
        confidence_score: newConfidence,
        review_status: 'approved',
        updated_at: new Date().toISOString(),
      });

    const updated = await db('lease_abstractions').where('id', id).first();
    return {
      ...updated,
      extracted_terms:
        typeof updated.extracted_terms === 'string'
          ? JSON.parse(updated.extracted_terms)
          : updated.extracted_terms,
      renewal_options:
        typeof updated.renewal_options === 'string'
          ? JSON.parse(updated.renewal_options)
          : updated.renewal_options,
      rent_escalation:
        typeof updated.rent_escalation === 'string'
          ? JSON.parse(updated.rent_escalation)
          : updated.rent_escalation,
    };
  },

  /**
   * Reject an abstraction (sets review_status='needs_correction').
   */
  async rejectAbstraction(id: string): Promise<LeaseAbstractionRecord> {
    const record = await db('lease_abstractions').where('id', id).first();
    if (!record) {
      throw new AppError(404, 'ABSTRACTION_NOT_FOUND', `Abstraction with id '${id}' not found`);
    }

    await db('lease_abstractions')
      .where('id', id)
      .update({ review_status: 'needs_correction', updated_at: new Date().toISOString() });

    const updated = await db('lease_abstractions').where('id', id).first();
    return {
      ...updated,
      extracted_terms:
        typeof updated.extracted_terms === 'string'
          ? JSON.parse(updated.extracted_terms)
          : updated.extracted_terms,
      renewal_options:
        typeof updated.renewal_options === 'string'
          ? JSON.parse(updated.renewal_options)
          : updated.renewal_options,
      rent_escalation:
        typeof updated.rent_escalation === 'string'
          ? JSON.parse(updated.rent_escalation)
          : updated.rent_escalation,
    };
  },
};

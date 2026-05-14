/**
 * Interfaces for the AI Lease Abstraction service.
 */

export interface ExtractedTerm {
  fieldName: string;
  value: string;
  confidence: number;
  sourcePageNumber: number;
  sourceText: string;
}

export interface AbstractionResult {
  documentId: string;
  extractedTerms: ExtractedTerm[];
  overallConfidence: number;
  requiresReview: boolean;
}

export interface LeaseAbstractionRecord {
  id: string;
  document_id: string;
  tenant_id: string;
  commencement_date: string;
  expiration_date: string;
  base_rent_cents: number;
  rent_escalation: unknown;
  cam_cap_cents: number | null;
  security_deposit_cents: number;
  renewal_options: unknown;
  extracted_terms: ExtractedTerm[];
  confidence_score: number;
  review_status: 'pending' | 'approved' | 'needs_correction';
  created_at: string;
  updated_at: string;
}

/** Required fields that must be present in extraction results */
export const REQUIRED_FIELDS = [
  'commencement_date',
  'expiration_date',
  'base_rent',
  'tenant_name',
  'premises_description',
] as const;

/** Minimum confidence threshold below which human review is required */
export const LOW_CONFIDENCE_THRESHOLD = 0.60;

/** Minimum number of terms expected from extraction */
export const MIN_TERMS_FOR_AUTO_APPROVAL = 5;

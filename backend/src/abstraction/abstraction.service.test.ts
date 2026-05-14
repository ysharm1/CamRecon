import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateOverallConfidence, needsHumanReview } from './abstraction.service';
import { extractTerms } from './mock-extractor';
import { ExtractedTerm } from './abstraction.types';

describe('abstraction.service', () => {
  describe('calculateOverallConfidence', () => {
    it('should return 0 for empty terms array', () => {
      expect(calculateOverallConfidence([])).toBe(0);
    });

    it('should return the single term confidence for one term', () => {
      const terms: ExtractedTerm[] = [
        { fieldName: 'tenant_name', value: 'Test', confidence: 0.85, sourcePageNumber: 1, sourceText: 'Test' },
      ];
      expect(calculateOverallConfidence(terms)).toBe(0.85);
    });

    it('should return arithmetic mean of all term confidence scores', () => {
      const terms: ExtractedTerm[] = [
        { fieldName: 'tenant_name', value: 'Test', confidence: 0.90, sourcePageNumber: 1, sourceText: 'Test' },
        { fieldName: 'base_rent', value: '5000', confidence: 0.80, sourcePageNumber: 2, sourceText: 'Test' },
        { fieldName: 'commencement_date', value: '2024-01-01', confidence: 0.70, sourcePageNumber: 3, sourceText: 'Test' },
      ];
      // (0.90 + 0.80 + 0.70) / 3 = 0.80
      expect(calculateOverallConfidence(terms)).toBeCloseTo(0.80, 10);
    });

    it('should handle terms with identical confidence scores', () => {
      const terms: ExtractedTerm[] = [
        { fieldName: 'a', value: 'v', confidence: 0.75, sourcePageNumber: 1, sourceText: 's' },
        { fieldName: 'b', value: 'v', confidence: 0.75, sourcePageNumber: 1, sourceText: 's' },
      ];
      expect(calculateOverallConfidence(terms)).toBeCloseTo(0.75, 10);
    });
  });

  describe('needsHumanReview', () => {
    const makeTerms = (count: number, confidence = 0.85): ExtractedTerm[] => {
      const requiredFields = ['commencement_date', 'expiration_date', 'base_rent', 'tenant_name', 'premises_description'];
      return Array.from({ length: count }, (_, i) => ({
        fieldName: i < requiredFields.length ? requiredFields[i] : `field_${i}`,
        value: `value_${i}`,
        confidence,
        sourcePageNumber: 1,
        sourceText: `source text ${i}`,
      }));
    };

    it('should return true when any term has confidence below 0.60', () => {
      const terms = makeTerms(5, 0.85);
      terms[2].confidence = 0.55; // Below threshold
      expect(needsHumanReview(terms)).toBe(true);
    });

    it('should return true when fewer than 5 terms are extracted', () => {
      const terms = makeTerms(4, 0.90);
      expect(needsHumanReview(terms)).toBe(true);
    });

    it('should return true when required fields are missing', () => {
      const terms: ExtractedTerm[] = [
        { fieldName: 'tenant_name', value: 'Test', confidence: 0.90, sourcePageNumber: 1, sourceText: 's' },
        { fieldName: 'base_rent', value: '5000', confidence: 0.90, sourcePageNumber: 1, sourceText: 's' },
        { fieldName: 'commencement_date', value: '2024-01-01', confidence: 0.90, sourcePageNumber: 1, sourceText: 's' },
        { fieldName: 'expiration_date', value: '2025-01-01', confidence: 0.90, sourcePageNumber: 1, sourceText: 's' },
        // Missing premises_description
        { fieldName: 'security_deposit', value: '10000', confidence: 0.90, sourcePageNumber: 1, sourceText: 's' },
      ];
      expect(needsHumanReview(terms)).toBe(true);
    });

    it('should return false when all conditions are met', () => {
      const terms = makeTerms(5, 0.85);
      expect(needsHumanReview(terms)).toBe(false);
    });

    it('should return false with more than 5 terms and all required fields present', () => {
      const terms = makeTerms(7, 0.90);
      expect(needsHumanReview(terms)).toBe(false);
    });

    it('should return true for empty terms array (fewer than 5)', () => {
      expect(needsHumanReview([])).toBe(true);
    });

    it('should return true when confidence is exactly 0.60 (not below threshold)', () => {
      const terms = makeTerms(5, 0.60);
      // 0.60 is NOT below 0.60, so this should pass the confidence check
      // but all required fields are present and count >= 5
      expect(needsHumanReview(terms)).toBe(false);
    });

    it('should return true when confidence is 0.59 (below threshold)', () => {
      const terms = makeTerms(5, 0.85);
      terms[0].confidence = 0.59;
      expect(needsHumanReview(terms)).toBe(true);
    });
  });

  describe('mock-extractor', () => {
    it('should return commercial lease terms for lease documents', () => {
      const terms = extractTerms('Commercial Lease Agreement', 'lease');
      expect(terms.length).toBeGreaterThanOrEqual(5);
      expect(terms.length).toBeLessThanOrEqual(8);

      const fieldNames = terms.map((t) => t.fieldName);
      expect(fieldNames).toContain('tenant_name');
      expect(fieldNames).toContain('commencement_date');
      expect(fieldNames).toContain('expiration_date');
      expect(fieldNames).toContain('base_rent');
      expect(fieldNames).toContain('premises_description');
    });

    it('should return retail lease terms for retail documents', () => {
      const terms = extractTerms('Retail Store Lease', 'lease');
      expect(terms.length).toBeGreaterThanOrEqual(5);

      const tenantTerm = terms.find((t) => t.fieldName === 'tenant_name');
      expect(tenantTerm?.value).toBe('Fresh Market Foods LLC');
    });

    it('should return office lease terms for office documents', () => {
      const terms = extractTerms('Office Space Lease - TechStart', 'lease');
      expect(terms.length).toBeGreaterThanOrEqual(5);

      const tenantTerm = terms.find((t) => t.fieldName === 'tenant_name');
      expect(tenantTerm?.value).toBe('TechStart Inc.');
    });

    it('should assign confidence scores between 0.70 and 0.98', () => {
      const terms = extractTerms('Standard Lease', 'lease');
      for (const term of terms) {
        expect(term.confidence).toBeGreaterThanOrEqual(0.70);
        expect(term.confidence).toBeLessThanOrEqual(0.98);
      }
    });

    it('should include source page numbers and source text for all terms', () => {
      const terms = extractTerms('Commercial Lease', 'lease');
      for (const term of terms) {
        expect(term.sourcePageNumber).toBeGreaterThanOrEqual(1);
        expect(term.sourceText.length).toBeGreaterThan(0);
      }
    });
  });
});

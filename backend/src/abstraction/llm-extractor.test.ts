import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isLLMConfigured, llmExtractTerms } from './llm-extractor';
import type { ParsedPdfResult } from './pdf-parser';

describe('llm-extractor', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isLLMConfigured', () => {
    it('should return false when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(isLLMConfigured()).toBe(false);
    });

    it('should return false when OPENAI_API_KEY is the placeholder value', () => {
      process.env.OPENAI_API_KEY = 'sk-your-key-here';
      expect(isLLMConfigured()).toBe(false);
    });

    it('should return false when OPENAI_API_KEY is empty', () => {
      process.env.OPENAI_API_KEY = '';
      expect(isLLMConfigured()).toBe(false);
    });

    it('should return false when OPENAI_API_KEY is too short', () => {
      process.env.OPENAI_API_KEY = 'sk-short';
      expect(isLLMConfigured()).toBe(false);
    });

    it('should return true when OPENAI_API_KEY is a valid-looking key', () => {
      process.env.OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
      expect(isLLMConfigured()).toBe(true);
    });
  });

  describe('llmExtractTerms', () => {
    const mockPdfResult: ParsedPdfResult = {
      fullText: 'This is a test lease document.',
      pages: [
        { pageNumber: 1, text: 'This is page 1 of the lease.' },
        { pageNumber: 2, text: 'This is page 2 with rent details.' },
      ],
      totalPages: 2,
    };

    it('should fall back to mock extractor when no API key is configured', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await llmExtractTerms(mockPdfResult, 'Commercial Lease', 'lease');

      expect(result.provider).toBe('mock');
      expect(result.model).toBe('mock-extractor');
      expect(result.tokenUsage).toBeNull();
      expect(result.terms.length).toBeGreaterThan(0);
      expect(result.durationMs).toBe(0);
    });

    it('should fall back to mock extractor when API key is placeholder', async () => {
      process.env.OPENAI_API_KEY = 'sk-your-key-here';

      const result = await llmExtractTerms(mockPdfResult, 'Office Lease - TechStart', 'lease');

      expect(result.provider).toBe('mock');
      expect(result.model).toBe('mock-extractor');
      expect(result.terms.length).toBeGreaterThan(0);
    });

    it('should return mock terms with correct structure', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await llmExtractTerms(mockPdfResult, 'Retail Store Lease', 'lease');

      for (const term of result.terms) {
        expect(term).toHaveProperty('fieldName');
        expect(term).toHaveProperty('value');
        expect(term).toHaveProperty('confidence');
        expect(term).toHaveProperty('sourcePageNumber');
        expect(term).toHaveProperty('sourceText');
        expect(term.confidence).toBeGreaterThanOrEqual(0);
        expect(term.confidence).toBeLessThanOrEqual(1);
        expect(term.sourcePageNumber).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

import OpenAI from 'openai';
import { ExtractedTerm } from './abstraction.types';
import { ParsedPdfResult } from './pdf-parser';
import { extractTerms as mockExtractTerms } from './mock-extractor';
import { AppError } from '../middleware';

/**
 * Token usage tracking for cost monitoring.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

/**
 * Result from the LLM extraction including terms and usage metadata.
 */
export interface LLMExtractionResult {
  terms: ExtractedTerm[];
  tokenUsage: TokenUsage | null;
  provider: string;
  model: string;
  durationMs: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

// GPT-4o pricing (approximate, per 1K tokens)
const GPT4O_INPUT_COST_PER_1K = 0.0025;
const GPT4O_OUTPUT_COST_PER_1K = 0.01;

const LEASE_EXTRACTION_PROMPT = `You are a commercial real estate lease abstraction expert. Extract key lease terms from the following document text.

For each term you extract, provide:
- fieldName: a snake_case identifier. Use these standard names when applicable: tenant_name, commencement_date, expiration_date, base_rent, rent_escalation, cam_cap, security_deposit, premises_description, renewal_options, permitted_use, insurance_requirements, percentage_rent, maintenance_obligations, termination_clause
- value: the extracted value as a string
- confidence: a number between 0 and 1 indicating your confidence in the extraction accuracy
- sourcePageNumber: the page number where you found this term (1-indexed)
- sourceText: the exact text snippet from the document where this term was found (include enough context, typically 1-2 sentences)

Return your response as a JSON object with a single key "terms" containing an array of objects with the above fields. Only return the JSON object, no other text.

Document text (with page markers):
`;

/**
 * Check if the OpenAI API key is configured and valid (not a placeholder).
 */
export function isLLMConfigured(): boolean {
  const apiKey = process.env.OPENAI_API_KEY;
  return !!apiKey && apiKey !== 'sk-your-key-here' && apiKey.length > 10;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter.
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * config.baseDelayMs;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Determine if an error is retryable (rate limits, timeouts, server errors).
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Rate limit errors
    if (message.includes('429') || message.includes('rate')) return true;
    // Timeout errors
    if (message.includes('timeout') || message.includes('etimedout')) return true;
    // Server errors (5xx)
    if (message.includes('500') || message.includes('502') || message.includes('503')) return true;
  }
  return false;
}

/**
 * Calculate estimated cost from token usage.
 */
function calculateCost(usage: { prompt_tokens: number; completion_tokens: number }): number {
  const inputCost = (usage.prompt_tokens / 1000) * GPT4O_INPUT_COST_PER_1K;
  const outputCost = (usage.completion_tokens / 1000) * GPT4O_OUTPUT_COST_PER_1K;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // Round to 6 decimal places
}

/**
 * Parse the LLM JSON response into ExtractedTerm array.
 */
function parseLLMResponse(content: string): ExtractedTerm[] {
  try {
    let parsed = JSON.parse(content);

    // Handle wrapped response: { "terms": [...] }
    if (!Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      const arrayKey = keys.find((k) => Array.isArray(parsed[k]));
      if (arrayKey) {
        parsed = parsed[arrayKey];
      } else {
        throw new Error('Response is not an array and contains no array field');
      }
    }

    // Validate and normalize each term
    return parsed
      .map((item: any) => ({
        fieldName: String(item.fieldName || item.field_name || ''),
        value: String(item.value || ''),
        confidence: typeof item.confidence === 'number'
          ? Math.min(1, Math.max(0, item.confidence))
          : 0.85, // Default confidence if not provided
        sourcePageNumber: Number(item.sourcePageNumber || item.source_page_number || 1),
        sourceText: String(item.sourceText || item.source_text || ''),
      }))
      .filter((term: ExtractedTerm) => term.fieldName && term.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    throw new AppError(
      502,
      'LLM_PARSE_ERROR',
      `Failed to parse LLM extraction response: ${message}`
    );
  }
}

/**
 * Call OpenAI GPT-4o with retry logic and exponential backoff.
 */
async function callOpenAIWithRetry(
  documentText: string,
  apiKey: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ terms: ExtractedTerm[]; tokenUsage: TokenUsage | null }> {
  const client = new OpenAI({
    apiKey,
    timeout: 120_000,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a lease abstraction AI. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: LEASE_EXTRACTION_PROMPT + documentText,
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AppError(502, 'LLM_EMPTY_RESPONSE', 'LLM provider returned an empty response');
      }

      const terms = parseLLMResponse(content);

      // Track token usage
      let tokenUsage: TokenUsage | null = null;
      if (response.usage) {
        tokenUsage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          estimatedCostUsd: calculateCost(response.usage),
        };
      }

      return { terms, tokenUsage };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        break;
      }

      // Don't retry after the last attempt
      if (attempt < retryConfig.maxRetries) {
        const delay = calculateBackoffDelay(attempt, retryConfig);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted or non-retryable error
  if (lastError instanceof AppError) {
    throw lastError;
  }

  const message = lastError?.message || 'Unknown error';
  throw new AppError(502, 'LLM_EXTRACTION_ERROR', `LLM extraction failed after retries: ${message}`);
}

/**
 * Extract lease terms from a parsed PDF using the LLM.
 * Falls back to mock extractor when no API key is configured.
 *
 * @param pdfResult - Parsed PDF with page-level text
 * @param documentTitle - Title of the document (used for mock fallback)
 * @param documentType - Type of document (used for mock fallback)
 * @returns LLMExtractionResult with terms, token usage, and metadata
 */
export async function llmExtractTerms(
  pdfResult: ParsedPdfResult,
  documentTitle: string,
  documentType: string
): Promise<LLMExtractionResult> {
  // Fall back to mock if no API key is configured
  if (!isLLMConfigured()) {
    const mockTerms = mockExtractTerms(documentTitle, documentType);
    return {
      terms: mockTerms,
      tokenUsage: null,
      provider: 'mock',
      model: 'mock-extractor',
      durationMs: 0,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY!;
  const startTime = Date.now();

  // Format document text with page markers
  const documentText = pdfResult.pages
    .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
    .join('\n\n');

  try {
    const { terms, tokenUsage } = await callOpenAIWithRetry(documentText, apiKey);
    const durationMs = Date.now() - startTime;

    return {
      terms,
      tokenUsage,
      provider: 'openai',
      model: 'gpt-4o',
      durationMs,
    };
  } catch (error) {
    // On rate limit or timeout after all retries, fall back to mock
    if (error instanceof AppError && error.code === 'LLM_EXTRACTION_ERROR') {
      const message = error.message.toLowerCase();
      if (message.includes('rate') || message.includes('timeout')) {
        const mockTerms = mockExtractTerms(documentTitle, documentType);
        return {
          terms: mockTerms,
          tokenUsage: null,
          provider: 'mock-fallback',
          model: 'mock-extractor',
          durationMs: Date.now() - startTime,
        };
      }
    }

    throw error;
  }
}

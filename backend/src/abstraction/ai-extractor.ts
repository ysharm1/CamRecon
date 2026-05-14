import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ExtractedTerm } from './abstraction.types';
import { ParsedPdfResult } from './pdf-parser';
import { extractTerms as mockExtractTerms } from './mock-extractor';
import { AppError } from '../middleware';

type AIProvider = 'openai' | 'anthropic';

interface AIExtractorConfig {
  provider: AIProvider;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  timeoutMs: number;
}

function getConfig(): AIExtractorConfig {
  const provider = (process.env.AI_PROVIDER || 'openai') as AIProvider;
  return {
    provider,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    timeoutMs: 120_000,
  };
}

/**
 * Check if a real AI provider is configured with valid API keys.
 */
export function isAIConfigured(): boolean {
  const config = getConfig();
  if (config.provider === 'openai') {
    return !!config.openaiApiKey && config.openaiApiKey !== 'sk-your-key-here';
  }
  if (config.provider === 'anthropic') {
    return !!config.anthropicApiKey && config.anthropicApiKey !== 'sk-ant-your-key-here';
  }
  return false;
}

const EXTRACTION_PROMPT = `You are a commercial real estate lease abstraction expert. Extract key lease terms from the following document text.

For each term you extract, provide:
- fieldName: a snake_case identifier (use these standard names when applicable: tenant_name, commencement_date, expiration_date, base_rent, premises_description, security_deposit, cam_cap, renewal_option, percentage_rent, rent_escalation, permitted_use, maintenance_obligations, insurance_requirements, termination_clause)
- value: the extracted value as a string
- confidence: a number between 0 and 1 indicating your confidence in the extraction accuracy
- sourcePageNumber: the page number where you found this term (1-indexed)
- sourceText: the exact text snippet from the document where this term was found (include enough context, typically 1-2 sentences)

Return your response as a JSON array of objects with the above fields. Only return the JSON array, no other text.

Document text:
`;

/**
 * Extract lease terms using OpenAI GPT-4o.
 */
async function extractWithOpenAI(
  pdfResult: ParsedPdfResult,
  apiKey: string,
  timeoutMs: number
): Promise<ExtractedTerm[]> {
  const client = new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 2,
  });

  const documentText = pdfResult.pages
    .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
    .join('\n\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a lease abstraction AI. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: EXTRACTION_PROMPT + documentText,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'AI provider returned an empty response');
  }

  return parseAIResponse(content);
}

/**
 * Extract lease terms using Anthropic Claude.
 */
async function extractWithAnthropic(
  pdfResult: ParsedPdfResult,
  apiKey: string,
  timeoutMs: number
): Promise<ExtractedTerm[]> {
  const client = new Anthropic({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 2,
  });

  const documentText = pdfResult.pages
    .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: EXTRACTION_PROMPT + documentText + '\n\nRespond with only the JSON array.',
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'AI provider returned an empty response');
  }

  return parseAIResponse(textBlock.text);
}

/**
 * Parse the AI response JSON into ExtractedTerm array.
 */
function parseAIResponse(content: string): ExtractedTerm[] {
  try {
    // Try parsing directly as array
    let parsed = JSON.parse(content);

    // Handle case where response is wrapped in an object (e.g., { "terms": [...] })
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
    return parsed.map((item: any) => ({
      fieldName: String(item.fieldName || item.field_name || ''),
      value: String(item.value || ''),
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
      sourcePageNumber: Number(item.sourcePageNumber || item.source_page_number || 1),
      sourceText: String(item.sourceText || item.source_text || ''),
    })).filter((term: ExtractedTerm) => term.fieldName && term.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    throw new AppError(
      502,
      'AI_PARSE_ERROR',
      `Failed to parse AI extraction response: ${message}`
    );
  }
}

/**
 * Extract lease terms from a parsed PDF using AI.
 * Falls back to mock extractor if no API key is configured.
 */
export async function aiExtractTerms(
  pdfResult: ParsedPdfResult,
  documentTitle: string,
  documentType: string
): Promise<ExtractedTerm[]> {
  // Fall back to mock if no AI is configured
  if (!isAIConfigured()) {
    return mockExtractTerms(documentTitle, documentType);
  }

  const config = getConfig();

  try {
    if (config.provider === 'openai' && config.openaiApiKey) {
      return await extractWithOpenAI(pdfResult, config.openaiApiKey, config.timeoutMs);
    }

    if (config.provider === 'anthropic' && config.anthropicApiKey) {
      return await extractWithAnthropic(pdfResult, config.anthropicApiKey, config.timeoutMs);
    }

    // If configured provider doesn't have a key, fall back to mock
    return mockExtractTerms(documentTitle, documentType);
  } catch (error) {
    // On rate limit or timeout, fall back to mock with a warning
    if (error instanceof AppError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    // Rate limit errors - fall back gracefully
    if (message.includes('429') || message.includes('rate')) {
      return mockExtractTerms(documentTitle, documentType);
    }

    // Timeout errors - fall back gracefully
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return mockExtractTerms(documentTitle, documentType);
    }

    throw new AppError(
      502,
      'AI_EXTRACTION_ERROR',
      `AI extraction failed: ${message}`
    );
  }
}

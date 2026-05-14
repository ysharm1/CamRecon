import { PDFParse } from 'pdf-parse';
import { AppError } from '../middleware';

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedPdfResult {
  fullText: string;
  pages: ParsedPage[];
  totalPages: number;
}

/**
 * Extract text content from a PDF buffer with page-level granularity.
 * Uses pdf-parse v2 PDFParse class to extract text with per-page results.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedPdfResult> {
  let parser: PDFParse | null = null;

  try {
    // Convert Buffer to Uint8Array for pdf-parse v2
    const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    parser = new PDFParse({ data });

    const textResult = await parser.getText();

    if (!textResult.text || textResult.text.trim().length === 0) {
      throw new AppError(
        422,
        'PDF_UNREADABLE',
        'The PDF file contains no extractable text. It may be scanned or image-based.'
      );
    }

    // pdf-parse v2 provides per-page text via textResult.pages
    const pages: ParsedPage[] = textResult.pages
      .filter((p) => p.text.trim().length > 0)
      .map((p) => ({
        pageNumber: p.num,
        text: p.text.trim(),
      }));

    // If no pages were returned with text, fall back to splitting the full text
    const finalPages = pages.length > 0
      ? pages
      : splitTextIntoPages(textResult.text, textResult.total);

    return {
      fullText: textResult.text,
      pages: finalPages,
      totalPages: textResult.total,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    // Handle common PDF parsing errors
    if (message.includes('Invalid') || message.includes('password')) {
      throw new AppError(
        422,
        'PDF_CORRUPTED',
        'The PDF file is corrupted, encrypted, or cannot be read.'
      );
    }

    throw new AppError(
      500,
      'PDF_PARSE_ERROR',
      `Failed to parse PDF: ${message}`
    );
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}

/**
 * Split full text into approximate pages.
 * Uses form feed characters if present, otherwise divides evenly.
 * Fallback for when per-page extraction doesn't return results.
 */
function splitTextIntoPages(fullText: string, numPages: number): ParsedPage[] {
  // Try splitting on form feed characters (common page separator in PDFs)
  const formFeedPages = fullText.split('\f').filter((p) => p.trim().length > 0);

  if (formFeedPages.length > 1) {
    return formFeedPages.map((text, index) => ({
      pageNumber: index + 1,
      text: text.trim(),
    }));
  }

  // If no form feeds, divide text approximately evenly across pages
  if (numPages <= 1) {
    return [{ pageNumber: 1, text: fullText.trim() }];
  }

  const lines = fullText.split('\n');
  const linesPerPage = Math.ceil(lines.length / numPages);
  const pages: ParsedPage[] = [];

  for (let i = 0; i < numPages; i++) {
    const start = i * linesPerPage;
    const end = Math.min(start + linesPerPage, lines.length);
    const pageText = lines.slice(start, end).join('\n').trim();

    if (pageText.length > 0) {
      pages.push({
        pageNumber: i + 1,
        text: pageText,
      });
    }
  }

  return pages;
}

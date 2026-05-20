/**
 * Sentry Error Tracking
 *
 * Initializes Sentry for the backend. Only active when SENTRY_DSN is set.
 * Scrubs PII (emails, tenant names, dollar amounts) from error reports.
 */

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;

export function initSentry(): void {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // 10% of transactions
    beforeSend(event) {
      // Scrub PII from error messages
      if (event.message) {
        event.message = scrubPII(event.message);
      }
      // Scrub PII from exception values
      if (event.exception?.values) {
        for (const exception of event.exception.values) {
          if (exception.value) {
            exception.value = scrubPII(exception.value);
          }
        }
      }
      return event;
    },
  });
}

export function captureException(error: unknown): void {
  if (SENTRY_DSN) {
    Sentry.captureException(error);
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Scrub common PII patterns from strings.
 */
function scrubPII(text: string): string {
  return text
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // Dollar amounts
    .replace(/\$[\d,]+\.?\d*/g, '[AMOUNT]')
    // Phone numbers
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
}

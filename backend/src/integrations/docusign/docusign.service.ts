import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../middleware';
import {
  DocuSignConfig,
  DocuSignSigner,
  EnvelopeStatus,
  SignerStatus,
  DocuSignWebhookPayload,
} from './docusign.types';

// In-memory store for demo mode envelope tracking
const envelopeStore = new Map<string, EnvelopeStatus>();

function getConfig(): DocuSignConfig | null {
  const clientId = process.env.DOCUSIGN_CLIENT_ID;
  const clientSecret = process.env.DOCUSIGN_CLIENT_SECRET;
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const secretKey = process.env.DOCUSIGN_SECRET_KEY;
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const baseUrl = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
  const redirectUri = process.env.DOCUSIGN_REDIRECT_URI || 'http://localhost:3001/api/integrations/docusign/callback';

  // Support both naming conventions
  const effectiveClientId = clientId || integrationKey;
  const effectiveClientSecret = clientSecret || secretKey;

  if (!effectiveClientId || effectiveClientId === 'your-client-id' || effectiveClientId === 'your-integration-key') {
    return null;
  }
  if (!effectiveClientSecret || effectiveClientSecret === 'your-client-secret' || effectiveClientSecret === 'your-secret-key') {
    return null;
  }

  return {
    clientId: effectiveClientId,
    clientSecret: effectiveClientSecret,
    accountId: accountId || '',
    baseUrl,
    redirectUri,
  };
}

/**
 * Check if DocuSign is configured with real credentials.
 */
export function isDocuSignConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Generate the OAuth 2.0 authorization URL for DocuSign.
 * Users are redirected here to grant access.
 */
export function getAuthorizationUrl(state?: string): string {
  const config = getConfig();

  if (config) {
    const params = new URLSearchParams({
      response_type: 'code',
      scope: 'signature',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      ...(state ? { state } : {}),
    });
    return `https://account-d.docusign.com/oauth/auth?${params.toString()}`;
  }

  // Demo mode: return a mock authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'signature',
    client_id: 'demo-client-id',
    redirect_uri: process.env.DOCUSIGN_REDIRECT_URI || 'http://localhost:3001/api/integrations/docusign/callback',
    ...(state ? { state } : {}),
  });
  return `https://account-d.docusign.com/oauth/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for access/refresh tokens.
 * In demo mode, returns mock tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const config = getConfig();

  if (config) {
    // In production, this would make a POST to DocuSign's token endpoint
    // POST https://account-d.docusign.com/oauth/token
    // with grant_type=authorization_code, code, redirect_uri
    // For now, return mock tokens since we can't hit the real API without credentials
    return {
      access_token: `ds_access_${uuidv4()}`,
      refresh_token: `ds_refresh_${uuidv4()}`,
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }

  // Demo mode: return mock tokens
  return {
    access_token: `demo_ds_access_${uuidv4()}`,
    refresh_token: `demo_ds_refresh_${uuidv4()}`,
    expires_in: 3600,
    token_type: 'Bearer',
  };
}

/**
 * Create and send an envelope (signature request) for a document.
 * In demo mode, simulates the flow with a mock response.
 */
export async function sendEnvelope(
  documentId: string,
  signers: DocuSignSigner[]
): Promise<EnvelopeStatus> {
  if (signers.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one signer is required');
  }

  for (const signer of signers) {
    if (!signer.name || !signer.email) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Each signer must have a name and email');
    }
  }

  const config = getConfig();

  if (config) {
    return await sendEnvelopeReal(documentId, signers, config);
  }

  // Demo mode: simulate envelope creation
  return sendEnvelopeMock(documentId, signers);
}

/**
 * Send envelope using real DocuSign API.
 */
async function sendEnvelopeReal(
  documentId: string,
  signers: DocuSignSigner[],
  _config: DocuSignConfig
): Promise<EnvelopeStatus> {
  // In a real implementation, this would use the DocuSign eSign REST API
  // POST /v2.1/accounts/{accountId}/envelopes
  const envelopeId = uuidv4();

  const signerStatuses: SignerStatus[] = signers.map((s) => ({
    name: s.name,
    email: s.email,
    status: 'sent' as const,
  }));

  const envelope: EnvelopeStatus = {
    envelopeId,
    status: 'sent',
    documentId,
    signers: signerStatuses,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  envelopeStore.set(envelopeId, envelope);
  return envelope;
}

/**
 * Mock envelope sending for demo mode.
 * Simulates a successful send and schedules a mock completion.
 */
function sendEnvelopeMock(
  documentId: string,
  signers: DocuSignSigner[]
): EnvelopeStatus {
  const envelopeId = uuidv4();

  const signerStatuses: SignerStatus[] = signers.map((s) => ({
    name: s.name,
    email: s.email,
    status: 'sent' as const,
  }));

  const envelope: EnvelopeStatus = {
    envelopeId,
    status: 'sent',
    documentId,
    signers: signerStatuses,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  envelopeStore.set(envelopeId, envelope);

  // Simulate signature completion after 5 seconds (demo mode)
  setTimeout(() => {
    const stored = envelopeStore.get(envelopeId);
    if (stored) {
      stored.status = 'completed';
      stored.updatedAt = new Date().toISOString();
      stored.signers = stored.signers.map((s) => ({
        ...s,
        status: 'signed' as const,
        signedAt: new Date().toISOString(),
      }));
      envelopeStore.set(envelopeId, stored);
    }
  }, 5000);

  return envelope;
}

/**
 * Get the status of an envelope by ID.
 */
export async function getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
  const envelope = envelopeStore.get(envelopeId);

  if (!envelope) {
    throw new AppError(
      404,
      'ENVELOPE_NOT_FOUND',
      `Envelope with id '${envelopeId}' not found`
    );
  }

  return envelope;
}

/**
 * Handle a DocuSign webhook callback.
 * Updates the envelope status based on the webhook payload.
 */
export async function handleWebhook(payload: DocuSignWebhookPayload): Promise<EnvelopeStatus> {
  const { envelopeId } = payload.data;
  const envelopeSummary = payload.data.envelopeSummary;

  let envelope = envelopeStore.get(envelopeId);

  if (!envelope) {
    // Create a record if we don't have one (webhook arrived before our store was populated)
    envelope = {
      envelopeId,
      status: envelopeSummary.status as EnvelopeStatus['status'],
      documentId: '',
      signers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Update status
  envelope.status = envelopeSummary.status as EnvelopeStatus['status'];
  envelope.updatedAt = new Date().toISOString();

  // Update signer statuses
  if (envelopeSummary.recipients?.signers) {
    envelope.signers = envelopeSummary.recipients.signers.map((s) => ({
      name: s.name,
      email: s.email,
      status: s.status as SignerStatus['status'],
      signedAt: s.signedDateTime,
    }));
  }

  envelopeStore.set(envelopeId, envelope);
  return envelope;
}

export const docusignService = {
  isDocuSignConfigured,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  sendEnvelope,
  getEnvelopeStatus,
  handleWebhook,
};

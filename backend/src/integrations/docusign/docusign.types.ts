/**
 * TypeScript interfaces for DocuSign integration.
 */

export interface DocuSignSigner {
  name: string;
  email: string;
  routingOrder?: number;
}

export interface SendEnvelopeRequest {
  documentId: string;
  signers: DocuSignSigner[];
}

export interface EnvelopeStatus {
  envelopeId: string;
  status: 'sent' | 'delivered' | 'completed' | 'declined' | 'voided';
  documentId: string;
  signers: SignerStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface SignerStatus {
  name: string;
  email: string;
  status: 'sent' | 'delivered' | 'signed' | 'declined';
  signedAt?: string;
}

export interface DocuSignWebhookPayload {
  event: string;
  apiVersion: string;
  uri: string;
  retryCount: number;
  configurationId: string;
  generatedDateTime: string;
  data: {
    accountId: string;
    envelopeId: string;
    envelopeSummary: {
      status: string;
      recipients: {
        signers: Array<{
          name: string;
          email: string;
          status: string;
          signedDateTime?: string;
        }>;
      };
    };
  };
}

export interface DocuSignConfig {
  clientId: string;
  clientSecret: string;
  accountId: string;
  baseUrl: string;
  redirectUri: string;
}

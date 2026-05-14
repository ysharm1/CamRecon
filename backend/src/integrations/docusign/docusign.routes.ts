import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../auth';
import { AppError } from '../../middleware';
import { docusignService } from './docusign.service';
import { integrationsService } from '../integrations.service';
import { SendEnvelopeRequest, DocuSignWebhookPayload } from './docusign.types';

const router = Router();

/**
 * GET /api/integrations/docusign/authorize
 * Generate the OAuth 2.0 authorization URL for DocuSign.
 * Redirects the user to DocuSign's consent page.
 */
router.get(
  '/authorize',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = (req as any).user?.id || 'demo-state';
      const authUrl = docusignService.getAuthorizationUrl(state);
      res.json({ data: { authorizationUrl: authUrl } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/integrations/docusign/callback
 * Handle the OAuth 2.0 callback from DocuSign.
 * Exchanges the authorization code for tokens and stores them.
 */
router.get(
  '/callback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state } = req.query;

      if (!code) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Authorization code is required');
      }

      const tokens = await docusignService.exchangeCodeForTokens(code as string);

      // Store the tokens in the integrations table
      const organizationId = (state as string) || 'demo-org';
      await integrationsService.connect({
        organizationId,
        provider: 'docusign',
        credentials: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        },
        config: { token_type: tokens.token_type },
      });

      // In a real app, redirect to the frontend integrations page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/integrations?provider=docusign&status=connected`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/integrations/docusign/send
 * Create and send an envelope for signature.
 */
router.post(
  '/send',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentId, signers } = req.body as SendEnvelopeRequest;

      if (!documentId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'documentId is required');
      }

      if (!signers || !Array.isArray(signers) || signers.length === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'signers array is required and must not be empty');
      }

      const result = await docusignService.sendEnvelope(documentId, signers);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/integrations/docusign/webhook
 * Handle DocuSign webhook callbacks.
 * Note: Webhooks from DocuSign are not authenticated with our JWT.
 */
router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as DocuSignWebhookPayload;

      if (!payload.data?.envelopeId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid webhook payload: missing envelopeId');
      }

      const result = await docusignService.handleWebhook(payload);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/integrations/docusign/status/:envelopeId
 * Get the status of an envelope.
 */
router.get(
  '/status/:envelopeId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { envelopeId } = req.params;

      if (!envelopeId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'envelopeId is required');
      }

      const result = await docusignService.getEnvelopeStatus(envelopeId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

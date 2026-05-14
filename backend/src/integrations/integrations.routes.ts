import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { integrationsService } from './integrations.service';
import { docusignService } from './docusign';
import { quickbooksService } from './quickbooks';
import { AppError } from '../middleware';

const router = Router();

interface IntegrationInfo {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  mode: 'live' | 'demo';
  lastSyncAt: string | null;
}

/**
 * GET /api/integrations
 * List all available integrations and their connection status.
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const qbStatus = await quickbooksService.getConnectionStatus();

      const integrations: IntegrationInfo[] = [
        {
          id: 'docusign',
          name: 'DocuSign',
          description: 'Electronic signature and document signing workflows',
          connected: true, // Always available (demo mode if no credentials)
          mode: docusignService.isDocuSignConfigured() ? 'live' : 'demo',
          lastSyncAt: null,
        },
        {
          id: 'quickbooks',
          name: 'QuickBooks',
          description: 'Accounting, invoicing, and financial reporting',
          connected: qbStatus.connected,
          mode: qbStatus.mode,
          lastSyncAt: qbStatus.lastSyncAt || null,
        },
      ];

      res.json({ data: integrations });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/integrations/:provider/connect
 * Initiate connection to an integration provider.
 * In demo mode, immediately marks as connected.
 */
router.post(
  '/:provider/connect',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider } = req.params;
      const validProviders = ['docusign', 'quickbooks'];

      if (!validProviders.includes(provider)) {
        throw new AppError(400, 'INVALID_PROVIDER', `Provider '${provider}' is not supported. Valid providers: ${validProviders.join(', ')}`);
      }

      // In demo mode, we simulate a successful connection
      const organizationId = (req as any).user?.organizationId || 'demo-org';

      await integrationsService.connect({
        organizationId,
        provider: provider as 'docusign' | 'quickbooks',
        credentials: {
          access_token: 'demo-access-token',
          refresh_token: 'demo-refresh-token',
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
        config: { mode: 'demo' },
      });

      res.json({
        data: {
          provider,
          status: 'connected',
          message: `Successfully connected to ${provider}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/integrations/:provider/disconnect
 * Disconnect from an integration provider.
 */
router.delete(
  '/:provider/disconnect',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider } = req.params;
      const validProviders = ['docusign', 'quickbooks'];

      if (!validProviders.includes(provider)) {
        throw new AppError(400, 'INVALID_PROVIDER', `Provider '${provider}' is not supported`);
      }

      const organizationId = (req as any).user?.organizationId || 'demo-org';

      await integrationsService.disconnect(organizationId, provider);

      res.json({
        data: {
          provider,
          status: 'disconnected',
          message: `Successfully disconnected from ${provider}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../auth';
import { AppError } from '../../middleware';
import { quickbooksService } from './quickbooks.service';
import { integrationsService } from '../integrations.service';
import {
  SyncInvoiceRequest,
  SyncChargesRequest,
  ImportExpensesRequest,
  ExportReconciliationRequest,
} from './quickbooks.types';

const router = Router();

/**
 * GET /api/integrations/quickbooks/authorize
 * Generate the OAuth 2.0 authorization URL for QuickBooks.
 */
router.get(
  '/authorize',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = (req as any).user?.id || 'demo-state';
      const authUrl = quickbooksService.getAuthorizationUrl(state);
      res.json({ data: { authorizationUrl: authUrl } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/integrations/quickbooks/callback
 * Handle the OAuth 2.0 callback from QuickBooks.
 */
router.get(
  '/callback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state, realmId } = req.query;

      if (!code) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Authorization code is required');
      }

      const tokens = await quickbooksService.exchangeCodeForTokens(code as string);

      // Store the tokens in the integrations table
      const organizationId = (state as string) || 'demo-org';
      await integrationsService.connect({
        organizationId,
        provider: 'quickbooks',
        credentials: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        },
        config: {
          token_type: tokens.token_type,
          realm_id: (realmId as string) || tokens.realm_id || '',
        },
      });

      // Redirect to the frontend integrations page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/integrations?provider=quickbooks&status=connected`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/integrations/quickbooks/sync-charges
 * Sync tenant charges to QuickBooks as invoices.
 */
router.post(
  '/sync-charges',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, charges } = req.body as SyncChargesRequest;

      if (!tenantId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'tenantId is required');
      }
      if (!charges || !Array.isArray(charges) || charges.length === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'charges array is required and must not be empty');
      }

      const result = await quickbooksService.syncCharges(tenantId, charges);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/integrations/quickbooks/import-expenses
 * Import expenses from QuickBooks for CAM reconciliation.
 */
router.post(
  '/import-expenses',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, accountIds } = req.body as ImportExpensesRequest;

      if (!startDate || !endDate) {
        throw new AppError(400, 'VALIDATION_ERROR', 'startDate and endDate are required');
      }

      const result = await quickbooksService.importExpenses(startDate, endDate, accountIds);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/integrations/quickbooks/sync-invoice
 * Sync tenant billing data to QuickBooks as an invoice (legacy endpoint).
 */
router.post(
  '/sync-invoice',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, reconciliationId } = req.body as SyncInvoiceRequest;

      if (!tenantId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'tenantId is required');
      }
      if (!reconciliationId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'reconciliationId is required');
      }

      const result = await quickbooksService.syncInvoice(tenantId, reconciliationId);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/integrations/quickbooks/export-reconciliation
 * Export CAM reconciliation results as journal entries.
 */
router.post(
  '/export-reconciliation',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reconciliationId } = req.body as ExportReconciliationRequest;

      if (!reconciliationId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'reconciliationId is required');
      }

      const result = await quickbooksService.exportReconciliation(reconciliationId);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/integrations/quickbooks/accounts
 * List chart of accounts from QuickBooks.
 */
router.get(
  '/accounts',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accounts = await quickbooksService.getChartOfAccounts();
      res.json({ data: accounts });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/integrations/quickbooks/status
 * Get QuickBooks connection status.
 */
router.get(
  '/status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await quickbooksService.getConnectionStatus();
      res.json({ data: status });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

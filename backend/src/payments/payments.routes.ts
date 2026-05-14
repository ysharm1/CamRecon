/**
 * Payments Routes
 *
 * Portal-protected routes (portal token auth):
 *   POST /api/portal/payments/create-session — Create Stripe Checkout session for CAM true-up
 *   GET  /api/portal/payments/history — Get payment history for the authenticated tenant
 *
 * Public routes (Stripe signature verification):
 *   POST /api/payments/webhook — Stripe webhook handler
 */

import { Router, Request, Response, NextFunction } from 'express';
import { portalAuthenticate } from '../portal/portal.middleware';
import { AppError } from '../middleware/errorHandler';
import {
  createCheckoutSession,
  handleWebhook,
  getTenantPayments,
} from './payments.service';
import { getTenantBalance } from '../portal/portal.service';

const router = Router();

/**
 * POST /api/portal/payments/create-session
 * Portal-protected: Creates a Stripe Checkout session for the tenant's positive variance.
 */
router.post(
  '/portal/payments/create-session',
  portalAuthenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.portalTenant) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Portal authentication is required');
      }

      const { tenantId, tenantName } = req.portalTenant;

      // Get the tenant's outstanding balance
      const balance = await getTenantBalance(tenantId);

      if (balance.outstandingBalanceCents <= 0) {
        throw new AppError(400, 'NO_BALANCE_DUE', 'No outstanding balance to pay');
      }

      // Allow partial payment if amount is specified in body
      const amountCents = req.body.amountCents
        ? Math.min(Number(req.body.amountCents), balance.outstandingBalanceCents)
        : balance.outstandingBalanceCents;

      const description = `CAM True-Up Payment for ${tenantName}`;

      const result = await createCheckoutSession(tenantId, amountCents, description);

      res.status(201).json({
        data: {
          sessionId: result.sessionId,
          checkoutUrl: result.checkoutUrl,
          paymentId: result.paymentId,
          amountCents,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/portal/payments/history
 * Portal-protected: Returns payment history for the authenticated tenant.
 */
router.get(
  '/portal/payments/history',
  portalAuthenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.portalTenant) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Portal authentication is required');
      }

      const payments = await getTenantPayments(req.portalTenant.tenantId);
      res.json({ data: payments });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/webhook
 * Public: Stripe webhook handler. Uses Stripe signature verification (no auth middleware).
 * Note: This route must receive the raw body for signature verification.
 */
router.post(
  '/payments/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        throw new AppError(400, 'MISSING_SIGNATURE', 'Stripe signature header is required');
      }

      const result = await handleWebhook(req.body, signature);

      res.json({ received: result.received });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

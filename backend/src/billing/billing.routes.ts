/**
 * Billing Routes
 *
 * Authenticated routes:
 *   GET  /api/billing/plan    — Get current plan and subscription info
 *   GET  /api/billing/usage   — Get current billing period usage
 *   GET  /api/billing/invoices — Get invoice history
 *   POST /api/billing/create-checkout — Create Stripe Checkout session for plan change
 *
 * Public routes (Stripe signature verification):
 *   POST /api/billing/webhook — Stripe billing webhook handler
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import { getCurrentUsage, getMonthlyUsage } from './usage.service';
import { getCurrentPlan, PLANS } from './plans.service';
import { createSubscriptionCheckout, handleBillingWebhook, getInvoices } from './stripe.service';

const router = Router();

/**
 * GET /api/billing/plan
 * Returns the current plan and subscription details for the user's organization.
 */
router.get(
  '/plan',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
      }

      const { plan, subscription } = await getCurrentPlan(req.user.organizationId);

      res.json({
        data: {
          plan: {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            limits: plan.limits,
            priceMonthly: plan.priceMonthly,
          },
          subscription,
          availablePlans: Object.values(PLANS).map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            limits: p.limits,
            priceMonthly: p.priceMonthly,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/billing/usage
 * Returns current billing period usage for the user's organization.
 */
router.get(
  '/usage',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
      }

      const usage = await getCurrentUsage(req.user.organizationId);
      const { plan } = await getCurrentPlan(req.user.organizationId);

      // Also get monthly breakdown if requested
      const now = new Date();
      const monthly = await getMonthlyUsage(
        req.user.organizationId,
        now.getFullYear(),
        now.getMonth() + 1
      );

      res.json({
        data: {
          current: usage,
          limits: plan.limits,
          planId: plan.id,
          planName: plan.name,
          monthly,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/billing/invoices
 * Returns invoice history for the user's organization.
 */
router.get(
  '/invoices',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
      }

      const invoices = await getInvoices(req.user.organizationId);

      res.json({ data: invoices });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/billing/create-checkout
 * Creates a Stripe Checkout session for upgrading/downgrading plans.
 * Only admins can change the plan.
 */
router.post(
  '/create-checkout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
      }

      if (req.user.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'Only admins can change the billing plan');
      }

      const { planId } = req.body;
      if (!planId || !PLANS[planId]) {
        throw new AppError(400, 'INVALID_PLAN', 'A valid planId is required (starter, pro, enterprise)');
      }

      const result = await createSubscriptionCheckout(req.user.organizationId, planId);

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/billing/webhook
 * Stripe billing webhook handler. Uses Stripe signature verification.
 */
router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        throw new AppError(400, 'MISSING_SIGNATURE', 'Stripe signature header is required');
      }

      const result = await handleBillingWebhook(req.body, signature);

      res.json({ received: result.received });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

/**
 * Stripe Billing Service
 *
 * Handles Stripe Checkout for plan upgrades, metered billing for AI usage overages,
 * and subscription webhook processing.
 * When STRIPE_SECRET_KEY is not configured, operates in demo mode with mock data.
 */

import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { PLANS } from './plans.service';
import { upsertSubscription, updateSubscriptionStatus } from './plans.service';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Get a Stripe instance (lazy-loaded).
 * Returns null if STRIPE_SECRET_KEY is not configured.
 */
function getStripe(): any | null {
  if (!STRIPE_SECRET_KEY) {
    return null;
  }
  const Stripe = require('stripe');
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
}

export interface CheckoutResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  createdAt: string;
  pdfUrl: string | null;
}

/**
 * Create a Stripe Checkout session for a plan upgrade/downgrade.
 * In demo mode, returns a mock checkout URL and updates the subscription directly.
 */
export async function createSubscriptionCheckout(
  organizationId: string,
  planId: string
): Promise<CheckoutResult> {
  const plan = PLANS[planId];
  if (!plan) {
    throw new AppError(400, 'INVALID_PLAN', `Plan "${planId}" does not exist`);
  }

  const stripe = getStripe();

  if (!stripe) {
    // Demo mode: directly update subscription and return mock URL
    await upsertSubscription(organizationId, planId, null);

    const mockSessionId = `demo_checkout_${Date.now()}`;
    return {
      sessionId: mockSessionId,
      checkoutUrl: `https://demo.stripe.com/checkout/${mockSessionId}`,
    };
  }

  // Real Stripe mode
  if (!plan.stripePriceId) {
    throw new AppError(400, 'PLAN_NOT_CONFIGURED', `Stripe price not configured for plan "${planId}"`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      organization_id: organizationId,
      plan_id: planId,
    },
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?status=cancelled`,
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
}

/**
 * Report metered usage to Stripe for AI call overages.
 * In demo mode, this is a no-op.
 */
export async function reportMeteredUsage(
  stripeSubscriptionId: string,
  quantity: number
): Promise<void> {
  const stripe = getStripe();
  if (!stripe || !stripeSubscriptionId) return;

  try {
    // Get the subscription's metered usage item
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const meteredItem = subscription.items.data.find(
      (item: any) => item.price.recurring?.usage_type === 'metered'
    );

    if (meteredItem) {
      await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
        quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment',
      });
    }
  } catch {
    // Non-critical: log but don't fail the request
  }
}

/**
 * Handle billing webhook events from Stripe.
 */
export async function handleBillingWebhook(
  payload: string | Buffer,
  signature: string
): Promise<{ received: boolean; eventType?: string }> {
  const stripe = getStripe();

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    throw new AppError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe billing is not configured');
  }

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    throw new AppError(400, 'WEBHOOK_SIGNATURE_FAILED', `Webhook signature verification failed: ${err.message}`);
  }

  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (subscriptionId) {
        await updateSubscriptionStatus(subscriptionId, 'active');
      }
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const status = mapStripeStatus(subscription.status);
      if (status) {
        await updateSubscriptionStatus(subscription.id, status);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await updateSubscriptionStatus(subscription.id, 'cancelled');
      break;
    }
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.metadata) {
        const { organization_id, plan_id } = session.metadata;
        if (organization_id && plan_id) {
          await upsertSubscription(organization_id, plan_id, session.subscription);
        }
      }
      break;
    }
  }

  return { received: true, eventType: event.type };
}

/**
 * Get invoices for an organization.
 * In demo mode, returns mock invoice data.
 */
export async function getInvoices(organizationId: string): Promise<Invoice[]> {
  const stripe = getStripe();

  // Get the subscription to find the Stripe customer
  const sub = await db('subscriptions')
    .where('organization_id', organizationId)
    .first();

  if (!stripe || !sub?.stripe_subscription_id) {
    // Demo mode: return mock invoices
    return getDemoInvoices(organizationId, sub?.plan_id || 'starter');
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const customerId = subscription.customer;

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 12,
    });

    return invoices.data.map((inv: any) => ({
      id: inv.id,
      amount: inv.amount_paid || inv.total,
      currency: inv.currency,
      status: inv.status,
      description: inv.description || `${PLANS[sub.plan_id]?.name || 'Plan'} subscription`,
      createdAt: new Date(inv.created * 1000).toISOString(),
      pdfUrl: inv.invoice_pdf,
    }));
  } catch {
    return getDemoInvoices(organizationId, sub.plan_id);
  }
}

/**
 * Generate demo invoices for organizations without Stripe configured.
 */
function getDemoInvoices(organizationId: string, planId: string): Invoice[] {
  const plan = PLANS[planId] || PLANS.starter;
  const invoices: Invoice[] = [];
  const now = new Date();

  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    invoices.push({
      id: `demo_inv_${organizationId}_${i}`,
      amount: plan.priceMonthly,
      currency: 'usd',
      status: i === 0 ? 'open' : 'paid',
      description: `${plan.name} Plan - ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      createdAt: date.toISOString(),
      pdfUrl: null,
    });
  }

  return invoices;
}

function mapStripeStatus(stripeStatus: string): 'active' | 'cancelled' | 'past_due' | null {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

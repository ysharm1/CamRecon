/**
 * Payments Service
 *
 * Handles Stripe payment integration for CAM true-up payments.
 * When STRIPE_SECRET_KEY is not configured, returns mock checkout URLs for demo mode.
 */

import db from '../db';
import { AppError } from '../middleware/errorHandler';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Get a Stripe instance (lazy-loaded).
 * Returns null if STRIPE_SECRET_KEY is not configured.
 */
function getStripe(): any | null {
  if (!STRIPE_SECRET_KEY) {
    return null;
  }
  // Dynamic import to avoid requiring stripe when not configured
  const Stripe = require('stripe');
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  paymentId: string;
}

/**
 * Create a Stripe Checkout session for a tenant's CAM true-up payment.
 * If Stripe is not configured, returns a mock checkout URL for demo mode.
 */
export async function createCheckoutSession(
  tenantId: string,
  amountCents: number,
  description: string
): Promise<CreateCheckoutSessionResult> {
  if (amountCents <= 0) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Payment amount must be positive');
  }

  // Verify tenant exists
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found');
  }

  const stripe = getStripe();

  if (!stripe) {
    // Demo mode: create a mock payment record
    const [payment] = await db('payments')
      .insert({
        tenant_id: tenantId,
        amount_cents: amountCents,
        stripe_session_id: `demo_session_${Date.now()}`,
        stripe_payment_intent_id: null,
        status: 'pending',
        description,
      })
      .returning(['id', 'stripe_session_id']);

    return {
      sessionId: payment.stripe_session_id,
      checkoutUrl: `https://demo.stripe.com/checkout/session/${payment.stripe_session_id}`,
      paymentId: payment.id,
    };
  }

  // Create a real Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'CAM True-Up Payment',
            description,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata: {
      tenant_id: tenantId,
    },
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/payment-cancelled`,
  });

  // Store payment record
  const [payment] = await db('payments')
    .insert({
      tenant_id: tenantId,
      amount_cents: amountCents,
      stripe_session_id: session.id,
      stripe_payment_intent_id: null,
      status: 'pending',
      description,
    })
    .returning(['id']);

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
    paymentId: payment.id,
  };
}

/**
 * Handle Stripe webhook events.
 * Processes checkout.session.completed events to mark payments as completed.
 */
export async function handleWebhook(
  payload: string | Buffer,
  signature: string
): Promise<{ received: boolean; eventType?: string }> {
  const stripe = getStripe();

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    throw new AppError(500, 'STRIPE_NOT_CONFIGURED', 'Stripe is not configured');
  }

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    throw new AppError(400, 'WEBHOOK_SIGNATURE_FAILED', `Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await handleCheckoutCompleted(session);
  }

  return { received: true, eventType: event.type };
}

/**
 * Process a completed checkout session.
 * Updates the payment record and logs to audit trail.
 */
async function handleCheckoutCompleted(session: any): Promise<void> {
  const stripeSessionId = session.id;
  const paymentIntentId = session.payment_intent;

  // Find the payment record
  const payment = await db('payments')
    .where({ stripe_session_id: stripeSessionId })
    .first();

  if (!payment) {
    // Payment not found — may be from a different source
    return;
  }

  // Update payment status
  await db('payments')
    .where({ id: payment.id })
    .update({
      status: 'completed',
      stripe_payment_intent_id: paymentIntentId,
      updated_at: new Date(),
    });

  // Log to audit trail
  await db('audit_trail').insert({
    user_id: null,
    action: 'payment_completed',
    entity_type: 'payment',
    entity_id: payment.id,
    metadata: JSON.stringify({
      tenant_id: payment.tenant_id,
      amount_cents: payment.amount_cents,
      stripe_session_id: stripeSessionId,
      stripe_payment_intent_id: paymentIntentId,
    }),
  });
}

/**
 * Get payment history for a tenant.
 */
export async function getTenantPayments(tenantId: string): Promise<Array<{
  id: string;
  amountCents: number;
  status: string;
  description: string | null;
  createdAt: string;
}>> {
  const payments = await db('payments')
    .where({ tenant_id: tenantId })
    .orderBy('created_at', 'desc')
    .select('id', 'amount_cents', 'status', 'description', 'created_at');

  return payments.map((p: {
    id: string;
    amount_cents: number;
    status: string;
    description: string | null;
    created_at: string;
  }) => ({
    id: p.id,
    amountCents: p.amount_cents,
    status: p.status,
    description: p.description,
    createdAt: p.created_at,
  }));
}

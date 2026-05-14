/**
 * Subscription & Plan Management Service
 *
 * Defines plan tiers (Starter, Pro, Enterprise) with resource limits.
 * Manages organization subscriptions and enforces plan limits.
 */

import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { getCurrentUsage } from './usage.service';

export interface PlanLimits {
  maxProperties: number;
  maxDocuments: number;
  maxAiCallsPerMonth: number;
  maxStorageBytes: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  limits: PlanLimits;
  priceMonthly: number; // in cents
  stripePriceId: string | null;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ResourceType = 'properties' | 'documents' | 'ai_calls' | 'storage';

// Plan definitions
export const PLANS: Record<string, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For small property managers getting started',
    limits: {
      maxProperties: 5,
      maxDocuments: 50,
      maxAiCallsPerMonth: 10,
      maxStorageBytes: 1 * 1024 * 1024 * 1024, // 1 GB
    },
    priceMonthly: 4900, // $49/mo
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For growing firms with advanced automation needs',
    limits: {
      maxProperties: 25,
      maxDocuments: -1, // unlimited
      maxAiCallsPerMonth: 100,
      maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    },
    priceMonthly: 14900, // $149/mo
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited access for large organizations',
    limits: {
      maxProperties: -1, // unlimited
      maxDocuments: -1, // unlimited
      maxAiCallsPerMonth: -1, // unlimited
      maxStorageBytes: -1, // unlimited
    },
    priceMonthly: 49900, // $499/mo
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
  },
};

/**
 * Get the current plan for an organization.
 * If no subscription exists, defaults to Starter plan.
 */
export async function getCurrentPlan(organizationId: string): Promise<{
  plan: Plan;
  subscription: Subscription | null;
}> {
  const sub = await db('subscriptions')
    .where('organization_id', organizationId)
    .first();

  if (!sub) {
    return { plan: PLANS.starter, subscription: null };
  }

  const plan = PLANS[sub.plan_id] || PLANS.starter;

  return {
    plan,
    subscription: {
      id: sub.id,
      organizationId: sub.organization_id,
      planId: sub.plan_id,
      status: sub.status,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      stripeSubscriptionId: sub.stripe_subscription_id,
      createdAt: sub.created_at,
      updatedAt: sub.updated_at,
    },
  };
}

/**
 * Check if an organization has reached its limit for a given resource.
 * Returns { allowed: true } if within limits, or throws AppError if limit exceeded.
 */
export async function checkLimit(
  organizationId: string,
  resource: ResourceType
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const { plan } = await getCurrentPlan(organizationId);
  const usage = await getCurrentUsage(organizationId);

  let current: number;
  let limit: number;

  switch (resource) {
    case 'properties': {
      const propertyCount = await db('properties')
        .where('organization_id', organizationId)
        .count('id as count')
        .first();
      current = Number(propertyCount?.count) || 0;
      limit = plan.limits.maxProperties;
      break;
    }
    case 'documents': {
      current = usage.documentUploads;
      limit = plan.limits.maxDocuments;
      break;
    }
    case 'ai_calls': {
      current = usage.aiCalls;
      limit = plan.limits.maxAiCallsPerMonth;
      break;
    }
    case 'storage': {
      current = usage.storageBytes;
      limit = plan.limits.maxStorageBytes;
      break;
    }
    default:
      throw new AppError(400, 'INVALID_RESOURCE', `Unknown resource type: ${resource}`);
  }

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, current, limit };
  }

  if (current >= limit) {
    throw new AppError(
      403,
      'PLAN_LIMIT_EXCEEDED',
      `You have reached your ${plan.name} plan limit for ${resource}. Current: ${current}, Limit: ${limit}. Please upgrade your plan.`,
      { resource, current, limit, planId: plan.id }
    );
  }

  return { allowed: true, current, limit };
}

/**
 * Create or update a subscription for an organization.
 */
export async function upsertSubscription(
  organizationId: string,
  planId: string,
  stripeSubscriptionId: string | null = null
): Promise<Subscription> {
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const existing = await db('subscriptions')
    .where('organization_id', organizationId)
    .first();

  if (existing) {
    const [updated] = await db('subscriptions')
      .where('organization_id', organizationId)
      .update({
        plan_id: planId,
        status: 'active',
        stripe_subscription_id: stripeSubscriptionId || existing.stripe_subscription_id,
        current_period_start: now.toISOString().split('T')[0],
        current_period_end: periodEnd.toISOString().split('T')[0],
        updated_at: new Date(),
      })
      .returning('*');

    return mapSubscription(updated);
  }

  const [created] = await db('subscriptions')
    .insert({
      organization_id: organizationId,
      plan_id: planId,
      status: 'active',
      current_period_start: now.toISOString().split('T')[0],
      current_period_end: periodEnd.toISOString().split('T')[0],
      stripe_subscription_id: stripeSubscriptionId,
    })
    .returning('*');

  return mapSubscription(created);
}

/**
 * Update subscription status (e.g., on webhook events).
 */
export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: 'active' | 'cancelled' | 'past_due'
): Promise<void> {
  await db('subscriptions')
    .where('stripe_subscription_id', stripeSubscriptionId)
    .update({ status, updated_at: new Date() });
}

function mapSubscription(row: any): Subscription {
  return {
    id: row.id,
    organizationId: row.organization_id,
    planId: row.plan_id,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    stripeSubscriptionId: row.stripe_subscription_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

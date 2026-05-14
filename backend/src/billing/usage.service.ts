/**
 * Usage Tracking Service
 *
 * Tracks billable events: AI abstraction calls, CAM reconciliation runs,
 * document uploads (with size), and active users.
 * Provides aggregation queries for monthly totals by event type per organization.
 */

import db from '../db';

export type UsageEventType =
  | 'ai_abstraction_call'
  | 'cam_reconciliation_run'
  | 'document_upload'
  | 'active_users';

export interface UsageEvent {
  id: string;
  organizationId: string;
  eventType: UsageEventType;
  quantity: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface MonthlyUsageSummary {
  eventType: string;
  totalQuantity: number;
  eventCount: number;
}

export interface CurrentUsageSummary {
  aiCalls: number;
  camRuns: number;
  documentUploads: number;
  storageBytes: number;
  activeUsers: number;
}

/**
 * Track a usage event for an organization.
 */
export async function trackEvent(
  organizationId: string,
  eventType: UsageEventType,
  quantity: number = 1,
  metadata: Record<string, unknown> | null = null
): Promise<UsageEvent> {
  const [event] = await db('usage_events')
    .insert({
      organization_id: organizationId,
      event_type: eventType,
      quantity,
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .returning(['id', 'organization_id', 'event_type', 'quantity', 'metadata', 'created_at']);

  return {
    id: event.id,
    organizationId: event.organization_id,
    eventType: event.event_type,
    quantity: event.quantity,
    metadata: event.metadata,
    createdAt: event.created_at,
  };
}

/**
 * Get monthly usage totals by event type for an organization.
 * @param organizationId - The organization to query
 * @param year - Year (e.g. 2024)
 * @param month - Month (1-12)
 */
export async function getMonthlyUsage(
  organizationId: string,
  year: number,
  month: number
): Promise<MonthlyUsageSummary[]> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const results = await db('usage_events')
    .where('organization_id', organizationId)
    .where('created_at', '>=', startDate.toISOString())
    .where('created_at', '<', endDate.toISOString())
    .groupBy('event_type')
    .select(
      'event_type as eventType',
      db.raw('SUM(quantity)::integer as "totalQuantity"'),
      db.raw('COUNT(*)::integer as "eventCount"')
    );

  return results.map((r: any) => ({
    eventType: r.eventType,
    totalQuantity: Number(r.totalQuantity),
    eventCount: Number(r.eventCount),
  }));
}

/**
 * Get current billing period usage for an organization.
 * Returns aggregated counts for the current calendar month.
 */
export async function getCurrentUsage(organizationId: string): Promise<CurrentUsageSummary> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const results = await db('usage_events')
    .where('organization_id', organizationId)
    .where('created_at', '>=', startOfMonth.toISOString())
    .groupBy('event_type')
    .select(
      'event_type as eventType',
      db.raw('SUM(quantity)::integer as "totalQuantity"')
    );

  const usageMap: Record<string, number> = {};
  for (const r of results as any[]) {
    usageMap[r.eventType] = Number(r.totalQuantity);
  }

  // Calculate total storage from metadata (sum of file sizes in bytes)
  const storageResult = await db('usage_events')
    .where('organization_id', organizationId)
    .where('event_type', 'document_upload')
    .select(db.raw("SUM((metadata->>'sizeBytes')::bigint) as \"totalBytes\""));

  const storageBytes = Number(storageResult[0]?.totalBytes) || 0;

  return {
    aiCalls: usageMap['ai_abstraction_call'] || 0,
    camRuns: usageMap['cam_reconciliation_run'] || 0,
    documentUploads: usageMap['document_upload'] || 0,
    storageBytes,
    activeUsers: usageMap['active_users'] || 0,
  };
}

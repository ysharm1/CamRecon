/**
 * Activity Feed Service
 *
 * Records and retrieves activity timeline entries for properties and tenants.
 * Activities include document uploads, version changes, reconciliation events,
 * and workflow state changes.
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db';

export interface ActivityEntry {
  id: string;
  user_id: string | null;
  organization_id: string;
  property_id: string | null;
  tenant_id: string | null;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RecordActivityInput {
  userId: string;
  organizationId: string;
  propertyId?: string;
  tenantId?: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export const activityService = {
  /**
   * Record an activity entry in the activity feed.
   */
  async recordActivity(input: RecordActivityInput): Promise<ActivityEntry> {
    const { userId, organizationId, propertyId, tenantId, action, description, metadata } = input;

    const [entry] = await db('activity_feed')
      .insert({
        id: uuidv4(),
        user_id: userId,
        organization_id: organizationId,
        property_id: propertyId || null,
        tenant_id: tenantId || null,
        action,
        description,
        metadata: JSON.stringify(metadata || {}),
      })
      .returning('*');

    return entry;
  },

  /**
   * Retrieve the activity timeline for a property, ordered by created_at descending.
   * Only returns entries for properties within the user's organization.
   */
  async getPropertyTimeline(
    propertyId: string,
    organizationId: string
  ): Promise<ActivityEntry[]> {
    // Verify property belongs to the user's organization
    const property = await db('properties')
      .where({ id: propertyId, owner_id: organizationId })
      .first();

    if (!property) {
      return [];
    }

    return db('activity_feed')
      .where({ property_id: propertyId, organization_id: organizationId })
      .orderBy('created_at', 'desc');
  },

  /**
   * Retrieve the activity timeline for a tenant, ordered by created_at descending.
   * Only returns entries for tenants within properties owned by the user's organization.
   */
  async getTenantTimeline(
    tenantId: string,
    organizationId: string
  ): Promise<ActivityEntry[]> {
    // Verify tenant belongs to a property in the user's organization
    const tenant = await db('tenants as t')
      .join('properties as p', 't.property_id', 'p.id')
      .where('t.id', tenantId)
      .where('p.owner_id', organizationId)
      .select('t.id')
      .first();

    if (!tenant) {
      return [];
    }

    return db('activity_feed')
      .where({ tenant_id: tenantId, organization_id: organizationId })
      .orderBy('created_at', 'desc');
  },
};

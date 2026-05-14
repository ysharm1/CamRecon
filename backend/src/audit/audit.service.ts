import { v4 as uuidv4 } from 'uuid';
import db from '../db';

export interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface LogActionInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export const auditService = {
  /**
   * Log an action to the audit trail.
   */
  async logAction(input: LogActionInput): Promise<AuditEntry> {
    const { userId, action, entityType, entityId, metadata, ipAddress } = input;

    const [entry] = await db('audit_trail')
      .insert({
        id: uuidv4(),
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: JSON.stringify(metadata || {}),
        ip_address: ipAddress || null,
      })
      .returning('*');

    return entry;
  },

  /**
   * Retrieve the audit trail for a given entity, ordered by created_at descending.
   */
  async getAuditTrail(entityType: string, entityId: string): Promise<AuditEntry[]> {
    return db('audit_trail')
      .where('entity_type', entityType)
      .andWhere('entity_id', entityId)
      .orderBy('created_at', 'desc');
  },
};

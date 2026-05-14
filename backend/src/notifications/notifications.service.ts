/**
 * Notifications Service
 *
 * Manages in-app notifications including:
 * - Creating notifications for lease expirations (30/60/90 day alerts)
 * - Creating notifications for overdue document reviews
 * - Listing notifications for a user (unread first, then by date)
 * - Marking notifications as read
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export const notificationsService = {
  /**
   * Create a new notification for a user.
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const { userId, type, title, message, link, metadata } = input;

    const [notification] = await db('notifications')
      .insert({
        id: uuidv4(),
        user_id: userId,
        type,
        title,
        message,
        is_read: false,
        link: link || null,
        metadata: JSON.stringify(metadata || {}),
      })
      .returning('*');

    return notification;
  },

  /**
   * List notifications for a user.
   * Returns unread first, then ordered by created_at descending.
   */
  async listNotifications(userId: string): Promise<Notification[]> {
    return db('notifications')
      .where({ user_id: userId })
      .orderByRaw('is_read ASC, created_at DESC');
  },

  /**
   * Mark a notification as read.
   * Returns the updated notification or null if not found / not owned by user.
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    const [updated] = await db('notifications')
      .where({ id: notificationId, user_id: userId })
      .update({ is_read: true })
      .returning('*');

    return updated || null;
  },

  /**
   * Generate lease expiration notifications for a given organization.
   * Creates alerts at 30, 60, and 90 day thresholds.
   */
  async generateLeaseExpirationAlerts(organizationId: string): Promise<Notification[]> {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);
    const in60Days = new Date(now);
    in60Days.setDate(in60Days.getDate() + 60);
    const in90Days = new Date(now);
    in90Days.setDate(in90Days.getDate() + 90);

    // Get property IDs for this organization
    const propertyIds = await db('properties')
      .where({ owner_id: organizationId })
      .pluck('id');

    if (propertyIds.length === 0) {
      return [];
    }

    // Find leases expiring within 90 days
    const expiringLeases = await db('lease_abstractions as la')
      .join('tenants as t', 'la.tenant_id', 't.id')
      .join('properties as p', 't.property_id', 'p.id')
      .join('documents as d', 'la.document_id', 'd.id')
      .whereIn('t.property_id', propertyIds)
      .where('la.expiration_date', '>=', now.toISOString().split('T')[0])
      .where('la.expiration_date', '<=', in90Days.toISOString().split('T')[0])
      .select(
        'la.id',
        'la.expiration_date',
        't.name as tenant_name',
        'p.name as property_name',
        'p.id as property_id',
        'd.uploaded_by'
      );

    const notifications: Notification[] = [];

    for (const lease of expiringLeases) {
      const expirationDate = new Date(lease.expiration_date);
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      let type: string;
      let title: string;

      if (daysUntilExpiration <= 30) {
        type = 'lease_expiration_urgent';
        title = `Urgent: Lease expiring in ${daysUntilExpiration} days`;
      } else if (daysUntilExpiration <= 60) {
        type = 'lease_expiration_warning';
        title = `Warning: Lease expiring in ${daysUntilExpiration} days`;
      } else {
        type = 'lease_expiration_notice';
        title = `Notice: Lease expiring in ${daysUntilExpiration} days`;
      }

      const notification = await this.createNotification({
        userId: lease.uploaded_by,
        type,
        title,
        message: `Lease for ${lease.tenant_name} at ${lease.property_name} expires on ${lease.expiration_date}.`,
        link: `/properties/${lease.property_id}`,
        metadata: {
          leaseAbstractionId: lease.id,
          tenantName: lease.tenant_name,
          propertyName: lease.property_name,
          expirationDate: lease.expiration_date,
          daysUntilExpiration,
        },
      });

      notifications.push(notification);
    }

    return notifications;
  },

  /**
   * Generate notifications for overdue document reviews.
   * Targets documents with pending review status.
   */
  async generateOverdueReviewAlerts(organizationId: string): Promise<Notification[]> {
    const propertyIds = await db('properties')
      .where({ owner_id: organizationId })
      .pluck('id');

    if (propertyIds.length === 0) {
      return [];
    }

    // Find lease abstractions with pending review
    const overdueReviews = await db('lease_abstractions as la')
      .join('tenants as t', 'la.tenant_id', 't.id')
      .join('properties as p', 't.property_id', 'p.id')
      .join('documents as d', 'la.document_id', 'd.id')
      .whereIn('t.property_id', propertyIds)
      .where('la.review_status', 'pending')
      .select(
        'la.id',
        'la.document_id',
        't.name as tenant_name',
        'p.name as property_name',
        'p.id as property_id',
        'd.uploaded_by'
      );

    const notifications: Notification[] = [];

    for (const review of overdueReviews) {
      const notification = await this.createNotification({
        userId: review.uploaded_by,
        type: 'overdue_review',
        title: 'Document review overdue',
        message: `Lease abstraction for ${review.tenant_name} at ${review.property_name} requires review.`,
        link: `/documents/${review.document_id}`,
        metadata: {
          leaseAbstractionId: review.id,
          documentId: review.document_id,
          tenantName: review.tenant_name,
          propertyName: review.property_name,
        },
      });

      notifications.push(notification);
    }

    return notifications;
  },
};

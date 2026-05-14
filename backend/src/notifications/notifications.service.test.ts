import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-notification',
}));

// Mock the db module
vi.mock('../db', () => {
  const mockDb = vi.fn();
  return { default: mockDb };
});

import { notificationsService } from './notifications.service';
import db from '../db';

describe('notifications.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should insert a notification and return it', async () => {
      const mockNotification = {
        id: 'test-uuid-notification',
        user_id: 'user-1',
        type: 'lease_expiration_urgent',
        title: 'Urgent: Lease expiring in 15 days',
        message: 'Lease for Tenant A at Property B expires on 2024-02-01.',
        is_read: false,
        link: '/properties/prop-1',
        metadata: { daysUntilExpiration: 15 },
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockReturning = vi.fn().mockResolvedValue([mockNotification]);
      const mockInsert = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db).mockReturnValue({ insert: mockInsert } as any);

      const result = await notificationsService.createNotification({
        userId: 'user-1',
        type: 'lease_expiration_urgent',
        title: 'Urgent: Lease expiring in 15 days',
        message: 'Lease for Tenant A at Property B expires on 2024-02-01.',
        link: '/properties/prop-1',
        metadata: { daysUntilExpiration: 15 },
      });

      expect(db).toHaveBeenCalledWith('notifications');
      expect(mockInsert).toHaveBeenCalledWith({
        id: 'test-uuid-notification',
        user_id: 'user-1',
        type: 'lease_expiration_urgent',
        title: 'Urgent: Lease expiring in 15 days',
        message: 'Lease for Tenant A at Property B expires on 2024-02-01.',
        is_read: false,
        link: '/properties/prop-1',
        metadata: JSON.stringify({ daysUntilExpiration: 15 }),
      });
      expect(result).toEqual(mockNotification);
    });

    it('should default link to null and metadata to empty object', async () => {
      const mockNotification = {
        id: 'test-uuid-notification',
        user_id: 'user-1',
        type: 'overdue_review',
        title: 'Document review overdue',
        message: 'Review required.',
        is_read: false,
        link: null,
        metadata: {},
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockReturning = vi.fn().mockResolvedValue([mockNotification]);
      const mockInsert = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db).mockReturnValue({ insert: mockInsert } as any);

      await notificationsService.createNotification({
        userId: 'user-1',
        type: 'overdue_review',
        title: 'Document review overdue',
        message: 'Review required.',
      });

      expect(mockInsert).toHaveBeenCalledWith({
        id: 'test-uuid-notification',
        user_id: 'user-1',
        type: 'overdue_review',
        title: 'Document review overdue',
        message: 'Review required.',
        is_read: false,
        link: null,
        metadata: JSON.stringify({}),
      });
    });
  });

  describe('listNotifications', () => {
    it('should return notifications ordered by unread first then by date descending', async () => {
      const mockNotifications = [
        {
          id: 'notif-2',
          user_id: 'user-1',
          type: 'lease_expiration_urgent',
          title: 'Urgent alert',
          is_read: false,
          created_at: '2024-01-16T10:00:00Z',
        },
        {
          id: 'notif-1',
          user_id: 'user-1',
          type: 'overdue_review',
          title: 'Review overdue',
          is_read: true,
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockOrderByRaw = vi.fn().mockResolvedValue(mockNotifications);
      const mockWhere = vi.fn().mockReturnValue({ orderByRaw: mockOrderByRaw });
      vi.mocked(db).mockReturnValue({ where: mockWhere } as any);

      const result = await notificationsService.listNotifications('user-1');

      expect(db).toHaveBeenCalledWith('notifications');
      expect(mockWhere).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(mockOrderByRaw).toHaveBeenCalledWith('is_read ASC, created_at DESC');
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read and return it', async () => {
      const mockUpdated = {
        id: 'notif-1',
        user_id: 'user-1',
        type: 'lease_expiration_urgent',
        title: 'Urgent alert',
        is_read: true,
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockReturning = vi.fn().mockResolvedValue([mockUpdated]);
      const mockUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockWhere = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(db).mockReturnValue({ where: mockWhere } as any);

      const result = await notificationsService.markAsRead('notif-1', 'user-1');

      expect(db).toHaveBeenCalledWith('notifications');
      expect(mockWhere).toHaveBeenCalledWith({ id: 'notif-1', user_id: 'user-1' });
      expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
      expect(result).toEqual(mockUpdated);
    });

    it('should return null when notification not found', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockWhere = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(db).mockReturnValue({ where: mockWhere } as any);

      const result = await notificationsService.markAsRead('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });
});

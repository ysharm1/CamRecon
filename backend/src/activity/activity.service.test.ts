import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-activity',
}));

// Mock the db module
vi.mock('../db', () => {
  const mockDb = vi.fn();
  return { default: mockDb };
});

import { activityService } from './activity.service';
import db from '../db';

describe('activity.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordActivity', () => {
    it('should insert an activity entry and return it', async () => {
      const mockEntry = {
        id: 'test-uuid-activity',
        user_id: 'user-1',
        organization_id: 'org-1',
        property_id: 'prop-1',
        tenant_id: 'tenant-1',
        action: 'document.uploaded',
        description: 'Uploaded lease document',
        metadata: { documentId: 'doc-1' },
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockReturning = vi.fn().mockResolvedValue([mockEntry]);
      const mockInsert = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db).mockReturnValue({ insert: mockInsert } as any);

      const result = await activityService.recordActivity({
        userId: 'user-1',
        organizationId: 'org-1',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        action: 'document.uploaded',
        description: 'Uploaded lease document',
        metadata: { documentId: 'doc-1' },
      });

      expect(db).toHaveBeenCalledWith('activity_feed');
      expect(mockInsert).toHaveBeenCalledWith({
        id: 'test-uuid-activity',
        user_id: 'user-1',
        organization_id: 'org-1',
        property_id: 'prop-1',
        tenant_id: 'tenant-1',
        action: 'document.uploaded',
        description: 'Uploaded lease document',
        metadata: JSON.stringify({ documentId: 'doc-1' }),
      });
      expect(result).toEqual(mockEntry);
    });

    it('should default optional fields to null', async () => {
      const mockEntry = {
        id: 'test-uuid-activity',
        user_id: 'user-1',
        organization_id: 'org-1',
        property_id: null,
        tenant_id: null,
        action: 'system.event',
        description: 'System event occurred',
        metadata: {},
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockReturning = vi.fn().mockResolvedValue([mockEntry]);
      const mockInsert = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db).mockReturnValue({ insert: mockInsert } as any);

      const result = await activityService.recordActivity({
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'system.event',
        description: 'System event occurred',
      });

      expect(mockInsert).toHaveBeenCalledWith({
        id: 'test-uuid-activity',
        user_id: 'user-1',
        organization_id: 'org-1',
        property_id: null,
        tenant_id: null,
        action: 'system.event',
        description: 'System event occurred',
        metadata: JSON.stringify({}),
      });
      expect(result).toEqual(mockEntry);
    });
  });

  describe('getPropertyTimeline', () => {
    it('should return activity entries for a property in reverse chronological order', async () => {
      const mockEntries = [
        {
          id: 'entry-2',
          action: 'document.uploaded',
          description: 'New document',
          created_at: '2024-01-16T10:00:00Z',
        },
        {
          id: 'entry-1',
          action: 'reconciliation.completed',
          description: 'CAM reconciliation done',
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockEntries);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

      // First call: property lookup
      const mockFirst = vi.fn().mockResolvedValue({ id: 'prop-1', owner_id: 'org-1' });
      const mockPropertyWhere = vi.fn().mockReturnValue({ first: mockFirst });

      let callCount = 0;
      vi.mocked(db).mockImplementation(((tableName: string) => {
        callCount++;
        if (tableName === 'properties') {
          return { where: mockPropertyWhere } as any;
        }
        return { where: mockWhere } as any;
      }) as any);

      const result = await activityService.getPropertyTimeline('prop-1', 'org-1');

      expect(mockPropertyWhere).toHaveBeenCalledWith({ id: 'prop-1', owner_id: 'org-1' });
      expect(mockWhere).toHaveBeenCalledWith({ property_id: 'prop-1', organization_id: 'org-1' });
      expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(result).toEqual(mockEntries);
    });

    it('should return empty array when property does not belong to organization', async () => {
      const mockFirst = vi.fn().mockResolvedValue(undefined);
      const mockPropertyWhere = vi.fn().mockReturnValue({ first: mockFirst });
      vi.mocked(db).mockReturnValue({ where: mockPropertyWhere } as any);

      const result = await activityService.getPropertyTimeline('prop-1', 'other-org');

      expect(result).toEqual([]);
    });
  });

  describe('getTenantTimeline', () => {
    it('should return activity entries for a tenant in reverse chronological order', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          action: 'lease.renewed',
          description: 'Lease renewed',
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockEntries);
      const mockActivityWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

      // Tenant lookup chain
      const mockFirst = vi.fn().mockResolvedValue({ id: 'tenant-1' });
      const mockSelect = vi.fn().mockReturnValue({ first: mockFirst });
      const mockTenantOrgWhere = vi.fn().mockReturnValue({ select: mockSelect });
      const mockTenantIdWhere = vi.fn().mockReturnValue({ where: mockTenantOrgWhere });
      const mockJoin = vi.fn().mockReturnValue({ where: mockTenantIdWhere });

      let callCount = 0;
      vi.mocked(db).mockImplementation(((tableName: string) => {
        callCount++;
        if (tableName === 'tenants as t') {
          return { join: mockJoin } as any;
        }
        return { where: mockActivityWhere } as any;
      }) as any);

      const result = await activityService.getTenantTimeline('tenant-1', 'org-1');

      expect(mockActivityWhere).toHaveBeenCalledWith({ tenant_id: 'tenant-1', organization_id: 'org-1' });
      expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(result).toEqual(mockEntries);
    });

    it('should return empty array when tenant does not belong to organization', async () => {
      const mockFirst = vi.fn().mockResolvedValue(undefined);
      const mockSelect = vi.fn().mockReturnValue({ first: mockFirst });
      const mockTenantOrgWhere = vi.fn().mockReturnValue({ select: mockSelect });
      const mockTenantIdWhere = vi.fn().mockReturnValue({ where: mockTenantOrgWhere });
      const mockJoin = vi.fn().mockReturnValue({ where: mockTenantIdWhere });
      vi.mocked(db).mockReturnValue({ join: mockJoin } as any);

      const result = await activityService.getTenantTimeline('tenant-1', 'other-org');

      expect(result).toEqual([]);
    });
  });
});

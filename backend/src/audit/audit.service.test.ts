import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../db', () => {
  const mockReturning = vi.fn();
  const mockInsert = vi.fn(() => ({ returning: mockReturning }));
  const mockOrderBy = vi.fn();
  const mockAndWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
  const mockWhere = vi.fn(() => ({ andWhere: mockAndWhere }));
  const mockDb = vi.fn(() => ({
    insert: mockInsert,
    where: mockWhere,
  }));
  return {
    default: mockDb,
    __mockInsert: mockInsert,
    __mockReturning: mockReturning,
    __mockWhere: mockWhere,
    __mockAndWhere: mockAndWhere,
    __mockOrderBy: mockOrderBy,
  };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

import { auditService } from './audit.service';
import db from '../db';

describe('audit.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAction', () => {
    it('should insert an audit trail entry and return it', async () => {
      const mockEntry = {
        id: 'test-uuid-123',
        user_id: 'user-1',
        action: 'document.created',
        entity_type: 'document',
        entity_id: 'doc-1',
        metadata: { title: 'Test Doc' },
        ip_address: '127.0.0.1',
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockReturning = vi.fn().mockResolvedValue([mockEntry]);
      const mockInsert = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db).mockReturnValue({ insert: mockInsert } as any);

      const result = await auditService.logAction({
        userId: 'user-1',
        action: 'document.created',
        entityType: 'document',
        entityId: 'doc-1',
        metadata: { title: 'Test Doc' },
        ipAddress: '127.0.0.1',
      });

      expect(db).toHaveBeenCalledWith('audit_trail');
      expect(mockInsert).toHaveBeenCalledWith({
        id: 'test-uuid-123',
        user_id: 'user-1',
        action: 'document.created',
        entity_type: 'document',
        entity_id: 'doc-1',
        metadata: JSON.stringify({ title: 'Test Doc' }),
        ip_address: '127.0.0.1',
      });
      expect(mockReturning).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockEntry);
    });

    it('should default metadata to empty object and ip_address to null', async () => {
      const mockEntry = {
        id: 'test-uuid-123',
        user_id: 'user-1',
        action: 'document.viewed',
        entity_type: 'document',
        entity_id: 'doc-1',
        metadata: {},
        ip_address: null,
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockReturning = vi.fn().mockResolvedValue([mockEntry]);
      const mockInsert = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db).mockReturnValue({ insert: mockInsert } as any);

      const result = await auditService.logAction({
        userId: 'user-1',
        action: 'document.viewed',
        entityType: 'document',
        entityId: 'doc-1',
      });

      expect(mockInsert).toHaveBeenCalledWith({
        id: 'test-uuid-123',
        user_id: 'user-1',
        action: 'document.viewed',
        entity_type: 'document',
        entity_id: 'doc-1',
        metadata: JSON.stringify({}),
        ip_address: null,
      });
      expect(result).toEqual(mockEntry);
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit entries ordered by created_at descending', async () => {
      const mockEntries = [
        {
          id: 'entry-2',
          user_id: 'user-1',
          action: 'document.viewed',
          entity_type: 'document',
          entity_id: 'doc-1',
          metadata: {},
          ip_address: null,
          created_at: '2024-01-16T10:00:00Z',
        },
        {
          id: 'entry-1',
          user_id: 'user-1',
          action: 'document.created',
          entity_type: 'document',
          entity_id: 'doc-1',
          metadata: { title: 'Test' },
          ip_address: null,
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockEntries);
      const mockAndWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere = vi.fn().mockReturnValue({ andWhere: mockAndWhere });
      vi.mocked(db).mockReturnValue({ where: mockWhere } as any);

      const result = await auditService.getAuditTrail('document', 'doc-1');

      expect(db).toHaveBeenCalledWith('audit_trail');
      expect(mockWhere).toHaveBeenCalledWith('entity_type', 'document');
      expect(mockAndWhere).toHaveBeenCalledWith('entity_id', 'doc-1');
      expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(result).toEqual(mockEntries);
      expect(result[0].created_at > result[1].created_at).toBe(true);
    });

    it('should return empty array when no entries exist', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockAndWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere = vi.fn().mockReturnValue({ andWhere: mockAndWhere });
      vi.mocked(db).mockReturnValue({ where: mockWhere } as any);

      const result = await auditService.getAuditTrail('document', 'nonexistent');

      expect(result).toEqual([]);
    });
  });
});

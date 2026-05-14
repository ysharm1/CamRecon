import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../db', () => {
  const mockQuery = {
    join: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    first: vi.fn(),
    select: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };

  const db = vi.fn(() => mockQuery);
  return { default: db, __mockQuery: mockQuery };
});

import { searchService } from './search.service';
import db from '../db';

describe('Search Service', () => {
  let mockQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the mock query object
    mockQuery = (db as any)('documents');
  });

  it('should return paginated search results', async () => {
    // Setup count result
    mockQuery.first.mockResolvedValue({ count: '2' });

    // Setup select results
    mockQuery.offset.mockResolvedValue([
      {
        document_id: 'doc-1',
        title: 'Office Lease Agreement',
        document_type: 'lease',
        updated_at: new Date('2024-01-15T10:00:00Z'),
        property_name: 'Downtown Tower',
        tenant_name: 'Acme Corp',
      },
      {
        document_id: 'doc-2',
        title: 'Lease Amendment',
        document_type: 'lease',
        updated_at: new Date('2024-02-01T10:00:00Z'),
        property_name: 'Uptown Plaza',
        tenant_name: null,
      },
    ]);

    const result = await searchService.search({
      textQuery: 'lease',
      page: 1,
      pageSize: 20,
    });

    expect(result.totalCount).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.hasMore).toBe(false);

    expect(result.results[0]).toEqual({
      documentId: 'doc-1',
      title: 'Office Lease Agreement',
      snippet: 'Office Lease Agreement',
      documentType: 'lease',
      propertyName: 'Downtown Tower',
      tenantName: 'Acme Corp',
      lastModified: '2024-01-15T10:00:00.000Z',
    });

    expect(result.results[1].tenantName).toBeNull();
  });

  it('should calculate hasMore correctly', async () => {
    mockQuery.first.mockResolvedValue({ count: '50' });
    mockQuery.offset.mockResolvedValue([]);

    const result = await searchService.search({
      textQuery: 'test',
      page: 1,
      pageSize: 20,
    });

    // page 1 * pageSize 20 = 20 < totalCount 50, so hasMore = true
    expect(result.hasMore).toBe(true);
  });

  it('should calculate hasMore=false on last page', async () => {
    mockQuery.first.mockResolvedValue({ count: '50' });
    mockQuery.offset.mockResolvedValue([]);

    const result = await searchService.search({
      textQuery: 'test',
      page: 3,
      pageSize: 20,
    });

    // page 3 * pageSize 20 = 60 >= totalCount 50, so hasMore = false
    expect(result.hasMore).toBe(false);
  });

  it('should apply ILIKE filter on text query', async () => {
    mockQuery.first.mockResolvedValue({ count: '0' });
    mockQuery.offset.mockResolvedValue([]);

    await searchService.search({
      textQuery: 'lease',
      page: 1,
      pageSize: 20,
    });

    // Verify db was called with 'documents' table
    expect(db).toHaveBeenCalledWith('documents');
    // Verify ILIKE was applied via where
    expect(mockQuery.where).toHaveBeenCalledWith('documents.title', 'ILIKE', '%lease%');
  });

  it('should apply optional filters when provided', async () => {
    mockQuery.first.mockResolvedValue({ count: '0' });
    mockQuery.offset.mockResolvedValue([]);

    await searchService.search({
      textQuery: 'test',
      propertyId: 'prop-123',
      tenantId: 'tenant-456',
      documentType: 'lease',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      page: 1,
      pageSize: 20,
    });

    // Verify filters were applied
    expect(mockQuery.where).toHaveBeenCalledWith('documents.property_id', 'prop-123');
    expect(mockQuery.where).toHaveBeenCalledWith('documents.tenant_id', 'tenant-456');
    expect(mockQuery.where).toHaveBeenCalledWith('documents.document_type', 'lease');
    expect(mockQuery.where).toHaveBeenCalledWith('documents.updated_at', '>=', '2024-01-01');
    expect(mockQuery.where).toHaveBeenCalledWith('documents.updated_at', '<=', '2024-12-31');
  });

  it('should calculate correct offset for pagination', async () => {
    mockQuery.first.mockResolvedValue({ count: '100' });
    mockQuery.offset.mockResolvedValue([]);

    await searchService.search({
      textQuery: 'test',
      page: 3,
      pageSize: 25,
    });

    // offset = (page - 1) * pageSize = (3 - 1) * 25 = 50
    expect(mockQuery.offset).toHaveBeenCalledWith(50);
    expect(mockQuery.limit).toHaveBeenCalledWith(25);
  });

  it('should truncate snippet to 200 characters', async () => {
    const longTitle = 'A'.repeat(300);
    mockQuery.first.mockResolvedValue({ count: '1' });
    mockQuery.offset.mockResolvedValue([
      {
        document_id: 'doc-1',
        title: longTitle,
        document_type: 'lease',
        updated_at: new Date('2024-01-15T10:00:00Z'),
        property_name: 'Prop',
        tenant_name: null,
      },
    ]);

    const result = await searchService.search({
      textQuery: 'A',
      page: 1,
      pageSize: 20,
    });

    expect(result.results[0].snippet.length).toBe(200);
  });
});

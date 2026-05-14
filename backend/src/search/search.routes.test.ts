import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware';

// Mock the auth middleware
vi.mock('../auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'property_manager',
      organizationId: 'org-123',
      firstName: 'Test',
      lastName: 'User',
    };
    next();
  },
}));

// Mock the search service
vi.mock('./search.service', () => ({
  searchService: {
    search: vi.fn(),
  },
}));

import searchRoutes from './search.routes';
import { searchService } from './search.service';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/search', searchRoutes);
  app.use(errorHandler);
  return app;
}

describe('Search Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  describe('GET /api/search', () => {
    it('should return search results for a valid query', async () => {
      const mockResponse = {
        results: [
          {
            documentId: 'doc-1',
            title: 'Office Lease Agreement',
            snippet: 'Office Lease Agreement',
            documentType: 'lease',
            propertyName: 'Downtown Tower',
            tenantName: 'Acme Corp',
            lastModified: '2024-01-15T10:00:00.000Z',
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      };

      vi.mocked(searchService.search).mockResolvedValue(mockResponse);

      const res = await request(app).get('/api/search?q=lease');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockResponse);
      expect(searchService.search).toHaveBeenCalledWith({
        textQuery: 'lease',
        propertyId: undefined,
        tenantId: undefined,
        documentType: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    it('should reject empty search query with validation error', async () => {
      const res = await request(app).get('/api/search?q=');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('empty');
    });

    it('should reject missing search query parameter', async () => {
      const res = await request(app).get('/api/search');

      expect(res.status).toBe(400);
    });

    it('should enforce maximum page size of 100', async () => {
      const res = await request(app).get('/api/search?q=test&pageSize=101');

      expect(res.status).toBe(400);
    });

    it('should reject page less than 1', async () => {
      const res = await request(app).get('/api/search?q=test&page=0');

      expect(res.status).toBe(400);
    });

    it('should pass optional filters to the service', async () => {
      vi.mocked(searchService.search).mockResolvedValue({
        results: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      });

      const propertyId = '550e8400-e29b-41d4-a716-446655440000';
      const tenantId = '660e8400-e29b-41d4-a716-446655440000';

      await request(app).get(
        `/api/search?q=lease&propertyId=${propertyId}&tenantId=${tenantId}&documentType=lease&dateFrom=2024-01-01&dateTo=2024-12-31`
      );

      expect(searchService.search).toHaveBeenCalledWith({
        textQuery: 'lease',
        propertyId,
        tenantId,
        documentType: 'lease',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        page: 1,
        pageSize: 20,
      });
    });

    it('should use custom page and pageSize', async () => {
      vi.mocked(searchService.search).mockResolvedValue({
        results: [],
        totalCount: 0,
        page: 3,
        pageSize: 50,
        hasMore: false,
      });

      await request(app).get('/api/search?q=test&page=3&pageSize=50');

      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          pageSize: 50,
        })
      );
    });

    it('should accept pageSize of exactly 100', async () => {
      vi.mocked(searchService.search).mockResolvedValue({
        results: [],
        totalCount: 0,
        page: 1,
        pageSize: 100,
        hasMore: false,
      });

      const res = await request(app).get('/api/search?q=test&pageSize=100');

      expect(res.status).toBe(200);
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 100,
        })
      );
    });

    it('should return hasMore=true when more results exist', async () => {
      vi.mocked(searchService.search).mockResolvedValue({
        results: [
          {
            documentId: 'doc-1',
            title: 'Test',
            snippet: 'Test',
            documentType: 'lease',
            propertyName: 'Prop',
            tenantName: null,
            lastModified: '2024-01-15T10:00:00.000Z',
          },
        ],
        totalCount: 50,
        page: 1,
        pageSize: 20,
        hasMore: true,
      });

      const res = await request(app).get('/api/search?q=test');

      expect(res.status).toBe(200);
      expect(res.body.data.hasMore).toBe(true);
      expect(res.body.data.totalCount).toBe(50);
    });
  });
});

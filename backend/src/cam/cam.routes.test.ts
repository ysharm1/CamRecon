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

// Mock the cam service
vi.mock('./cam.service', () => ({
  camService: {
    initiateReconciliation: vi.fn(),
    getReconciliation: vi.fn(),
    listReconciliations: vi.fn(),
  },
}));

import camRoutes from './cam.routes';
import { camService } from './cam.service';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reconciliations', camRoutes);
  app.use(errorHandler);
  return app;
}

describe('CAM Reconciliation Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  describe('POST /api/reconciliations', () => {
    const validBody = {
      propertyId: 'prop-123',
      periodStart: '2024-01-01',
      periodEnd: '2024-12-31',
      lineItems: [
        { category: 'Maintenance', description: 'HVAC repairs', amountCents: 500000 },
        { category: 'Insurance', description: 'Property insurance', amountCents: 300000 },
      ],
    };

    it('should initiate reconciliation successfully', async () => {
      const mockResult = {
        id: 'recon-123',
        propertyId: 'prop-123',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        totalExpensesCents: 800000,
        status: 'completed',
        createdBy: 'user-123',
        completedAt: '2024-01-15T10:00:00Z',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        lineItems: [],
        allocations: [],
      };

      vi.mocked(camService.initiateReconciliation).mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/reconciliations')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(mockResult);
      expect(camService.initiateReconciliation).toHaveBeenCalledWith(
        validBody,
        'user-123'
      );
    });

    it('should return 400 when propertyId is missing', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({ ...validBody, propertyId: undefined });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('propertyId');
    });

    it('should return 400 when periodStart is missing', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({ ...validBody, periodStart: undefined });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('periodStart');
    });

    it('should return 400 when periodEnd is missing', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({ ...validBody, periodEnd: undefined });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('periodEnd');
    });

    it('should return 400 when lineItems is empty', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({ ...validBody, lineItems: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('lineItems');
    });

    it('should return 400 when lineItems is not an array', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({ ...validBody, lineItems: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when a line item has no category', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({
          ...validBody,
          lineItems: [{ description: 'test', amountCents: 100 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('category');
    });

    it('should return 400 when a line item has invalid amountCents', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({
          ...validBody,
          lineItems: [{ category: 'Maintenance', description: 'test', amountCents: -100 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('amountCents');
    });

    it('should return 400 when periodEnd is before periodStart', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({ ...validBody, periodStart: '2024-12-31', periodEnd: '2024-01-01' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('periodEnd');
    });

    it('should return 400 when periodStart is invalid date', async () => {
      const res = await request(app)
        .post('/api/reconciliations')
        .send({ ...validBody, periodStart: 'not-a-date' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('periodStart');
    });

    it('should propagate service validation errors', async () => {
      const { AppError } = await import('../middleware');
      vi.mocked(camService.initiateReconciliation).mockRejectedValue(
        new AppError(400, 'VALIDATION_ERROR', 'Sum of tenant square footages exceeds total leasable area')
      );

      const res = await request(app)
        .post('/api/reconciliations')
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should propagate property not found errors', async () => {
      const { AppError } = await import('../middleware');
      vi.mocked(camService.initiateReconciliation).mockRejectedValue(
        new AppError(404, 'PROPERTY_NOT_FOUND', 'Property prop-123 not found')
      );

      const res = await request(app)
        .post('/api/reconciliations')
        .send(validBody);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });
  });

  describe('GET /api/reconciliations/:id', () => {
    it('should return a reconciliation by id', async () => {
      const mockResult = {
        id: 'recon-123',
        propertyId: 'prop-123',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        totalExpensesCents: 800000,
        status: 'completed',
        createdBy: 'user-123',
        completedAt: '2024-01-15T10:00:00Z',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        lineItems: [
          { id: 'li-1', reconciliationId: 'recon-123', category: 'Maintenance', description: 'HVAC', amountCents: 500000 },
        ],
        allocations: [
          {
            id: 'alloc-1',
            reconciliationId: 'recon-123',
            tenantId: 'tenant-1',
            squareFootage: 10000,
            sharePercentage: 0.5,
            estimatedAmountCents: 350000,
            actualAmountCents: 400000,
            varianceCents: 50000,
          },
        ],
      };

      vi.mocked(camService.getReconciliation).mockResolvedValue(mockResult);

      const res = await request(app).get('/api/reconciliations/recon-123');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockResult);
      expect(camService.getReconciliation).toHaveBeenCalledWith('recon-123');
    });

    it('should return 404 when reconciliation not found', async () => {
      const { AppError } = await import('../middleware');
      vi.mocked(camService.getReconciliation).mockRejectedValue(
        new AppError(404, 'RECONCILIATION_NOT_FOUND', 'Reconciliation nonexistent not found')
      );

      const res = await request(app).get('/api/reconciliations/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RECONCILIATION_NOT_FOUND');
    });
  });

  describe('GET /api/reconciliations', () => {
    it('should list reconciliations for a property', async () => {
      const mockResults = [
        {
          id: 'recon-1',
          propertyId: 'prop-123',
          periodStart: '2024-01-01',
          periodEnd: '2024-03-31',
          totalExpensesCents: 500000,
          status: 'completed',
          createdBy: 'user-123',
          completedAt: '2024-04-01T10:00:00Z',
          createdAt: '2024-04-01T10:00:00Z',
          updatedAt: '2024-04-01T10:00:00Z',
          lineItems: [],
          allocations: [],
        },
      ];

      vi.mocked(camService.listReconciliations).mockResolvedValue(mockResults);

      const res = await request(app).get('/api/reconciliations?propertyId=prop-123');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockResults);
      expect(camService.listReconciliations).toHaveBeenCalledWith('prop-123');
    });

    it('should return 400 when propertyId query param is missing', async () => {
      const res = await request(app).get('/api/reconciliations');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('propertyId');
    });
  });
});

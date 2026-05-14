/**
 * Report Generation Routes - Unit Tests
 *
 * Tests the report generation endpoints for validation and output format handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the reports service
vi.mock('./reports.service', () => ({
  getTenantStatementData: vi.fn(),
  getVarianceReportData: vi.fn(),
  getReconciliationPackageData: vi.fn(),
}));

// Mock the PDF generator
vi.mock('./pdf-generator', () => ({
  generateTenantStatementPDF: vi.fn(),
  generateVarianceReportPDF: vi.fn(),
  generateReconciliationPackagePDF: vi.fn(),
}));

// Mock the Excel generator
vi.mock('./excel-generator', () => ({
  generateTenantStatementExcel: vi.fn(),
  generateVarianceReportExcel: vi.fn(),
  generateReconciliationPackageExcel: vi.fn(),
}));

// Mock auth middleware
vi.mock('../auth', () => ({
  authenticate: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    _req.user = {
      userId: 'user-1',
      email: 'test@example.com',
      role: 'admin',
      organizationId: 'org-1',
      firstName: 'Test',
      lastName: 'User',
    };
    next();
  },
}));

import reportRoutes from './reports.routes';
import { getTenantStatementData, getVarianceReportData, getReconciliationPackageData } from './reports.service';
import { generateTenantStatementPDF, generateVarianceReportPDF, generateReconciliationPackagePDF } from './pdf-generator';
import { generateTenantStatementExcel, generateVarianceReportExcel, generateReconciliationPackageExcel } from './excel-generator';
import { PassThrough } from 'stream';
import { errorHandler } from '../middleware/errorHandler';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reports', reportRoutes);
  app.use(errorHandler);
  return app;
}

describe('Report Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/reports/tenant-statement', () => {
    it('should return 400 if tenantId is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/reports/tenant-statement')
        .query({ periodStart: '2024-01-01', periodEnd: '2024-12-31' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('tenantId');
    });

    it('should return 400 if periodStart is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/reports/tenant-statement')
        .query({ tenantId: 'tenant-1', periodEnd: '2024-12-31' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('periodStart');
    });

    it('should return 400 if periodEnd is missing', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/reports/tenant-statement')
        .query({ tenantId: 'tenant-1', periodStart: '2024-01-01' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('periodEnd');
    });

    it('should return 400 if periodEnd is before periodStart', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/reports/tenant-statement')
        .query({ tenantId: 'tenant-1', periodStart: '2024-12-31', periodEnd: '2024-01-01' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('periodEnd must be after periodStart');
    });

    it('should return 400 for invalid format', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/reports/tenant-statement')
        .query({
          tenantId: 'tenant-1',
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          format: 'invalid',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('format');
    });

    it('should generate PDF by default', async () => {
      const app = createApp();
      const mockData = {
        tenant: { id: 'tenant-1', name: 'Acme Corp', contactEmail: 'a@b.com', suiteNumber: '200', squareFootage: 5000 },
        property: { id: 'prop-1', name: 'Main Office', address: {} },
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        allocations: [],
        totalEstimatedCents: 0,
        totalActualCents: 0,
        totalVarianceCents: 0,
      };

      (getTenantStatementData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const mockStream = new PassThrough();
      (generateTenantStatementPDF as ReturnType<typeof vi.fn>).mockReturnValue(mockStream);

      // End the stream after a tick
      setTimeout(() => mockStream.end(Buffer.from('%PDF-1.4')), 10);

      const res = await request(app)
        .get('/api/reports/tenant-statement')
        .query({ tenantId: 'tenant-1', periodStart: '2024-01-01', periodEnd: '2024-12-31' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.pdf');
    });

    it('should generate Excel when format=excel', async () => {
      const app = createApp();
      const mockData = {
        tenant: { id: 'tenant-1', name: 'Acme Corp', contactEmail: 'a@b.com', suiteNumber: '200', squareFootage: 5000 },
        property: { id: 'prop-1', name: 'Main Office', address: {} },
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        allocations: [],
        totalEstimatedCents: 0,
        totalActualCents: 0,
        totalVarianceCents: 0,
      };

      (getTenantStatementData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const mockWorkbook = {
        xlsx: {
          write: vi.fn().mockResolvedValue(undefined),
        },
      };
      (generateTenantStatementExcel as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkbook);

      const res = await request(app)
        .get('/api/reports/tenant-statement')
        .query({
          tenantId: 'tenant-1',
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          format: 'excel',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('.xlsx');
      expect(generateTenantStatementExcel).toHaveBeenCalledWith(mockData);
    });
  });

  describe('GET /api/reports/variance', () => {
    it('should return 400 if reconciliationId is missing', async () => {
      const app = createApp();
      const res = await request(app).get('/api/reports/variance');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('reconciliationId');
    });

    it('should generate PDF variance report', async () => {
      const app = createApp();
      const mockData = {
        reconciliation: { id: 'rec-1', periodStart: '2024-01-01', periodEnd: '2024-12-31', totalExpensesCents: 100000, status: 'completed', completedAt: null },
        property: { id: 'prop-1', name: 'Main Office', address: {}, totalSquareFootage: 50000 },
        allocations: [],
        lineItems: [],
        totalEstimatedCents: 0,
        totalActualCents: 0,
        totalVarianceCents: 0,
      };

      (getVarianceReportData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const mockStream = new PassThrough();
      (generateVarianceReportPDF as ReturnType<typeof vi.fn>).mockReturnValue(mockStream);
      setTimeout(() => mockStream.end(Buffer.from('%PDF-1.4')), 10);

      const res = await request(app)
        .get('/api/reports/variance')
        .query({ reconciliationId: 'rec-1' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('variance-report');
    });

    it('should generate Excel variance report', async () => {
      const app = createApp();
      const mockData = {
        reconciliation: { id: 'rec-1', periodStart: '2024-01-01', periodEnd: '2024-12-31', totalExpensesCents: 100000, status: 'completed', completedAt: null },
        property: { id: 'prop-1', name: 'Main Office', address: {}, totalSquareFootage: 50000 },
        allocations: [],
        lineItems: [],
        totalEstimatedCents: 0,
        totalActualCents: 0,
        totalVarianceCents: 0,
      };

      (getVarianceReportData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const mockWorkbook = {
        xlsx: { write: vi.fn().mockResolvedValue(undefined) },
      };
      (generateVarianceReportExcel as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkbook);

      const res = await request(app)
        .get('/api/reports/variance')
        .query({ reconciliationId: 'rec-1', format: 'excel' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('.xlsx');
    });
  });

  describe('GET /api/reports/reconciliation-package', () => {
    it('should return 400 if reconciliationId is missing', async () => {
      const app = createApp();
      const res = await request(app).get('/api/reports/reconciliation-package');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('reconciliationId');
    });

    it('should generate PDF reconciliation package', async () => {
      const app = createApp();
      const mockData = {
        reconciliation: { id: 'rec-1', periodStart: '2024-01-01', periodEnd: '2024-12-31', totalExpensesCents: 100000, status: 'completed', completedAt: null },
        property: { id: 'prop-1', name: 'Main Office', address: {}, totalSquareFootage: 50000 },
        allocations: [],
        lineItems: [],
        expenseSummary: [],
        totalEstimatedCents: 0,
        totalActualCents: 0,
        totalVarianceCents: 0,
        generatedAt: '2024-06-01T00:00:00Z',
      };

      (getReconciliationPackageData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const mockStream = new PassThrough();
      (generateReconciliationPackagePDF as ReturnType<typeof vi.fn>).mockReturnValue(mockStream);
      setTimeout(() => mockStream.end(Buffer.from('%PDF-1.4')), 10);

      const res = await request(app)
        .get('/api/reports/reconciliation-package')
        .query({ reconciliationId: 'rec-1' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('reconciliation-package');
    });

    it('should generate Excel reconciliation package', async () => {
      const app = createApp();
      const mockData = {
        reconciliation: { id: 'rec-1', periodStart: '2024-01-01', periodEnd: '2024-12-31', totalExpensesCents: 100000, status: 'completed', completedAt: null },
        property: { id: 'prop-1', name: 'Main Office', address: {}, totalSquareFootage: 50000 },
        allocations: [],
        lineItems: [],
        expenseSummary: [],
        totalEstimatedCents: 0,
        totalActualCents: 0,
        totalVarianceCents: 0,
        generatedAt: '2024-06-01T00:00:00Z',
      };

      (getReconciliationPackageData as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const mockWorkbook = {
        xlsx: { write: vi.fn().mockResolvedValue(undefined) },
      };
      (generateReconciliationPackageExcel as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkbook);

      const res = await request(app)
        .get('/api/reports/reconciliation-package')
        .query({ reconciliationId: 'rec-1', format: 'excel' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('.xlsx');
    });
  });
});

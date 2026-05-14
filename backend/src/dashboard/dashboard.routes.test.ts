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

// Mock the dashboard service
vi.mock('./dashboard.service', () => ({
  dashboardService: {
    getDashboardData: vi.fn(),
  },
}));

import dashboardRoutes from './dashboard.routes';
import { dashboardService } from './dashboard.service';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboard', dashboardRoutes);
  app.use(errorHandler);
  return app;
}

describe('Dashboard Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  describe('GET /api/dashboard', () => {
    const mockDashboardData = {
      metrics: {
        totalProperties: 5,
        totalTenants: 42,
        occupancyRate: 0.87,
        totalLeasableArea: 250000,
      },
      leaseExpirations: {
        within30Days: 2,
        within60Days: 5,
        within90Days: 8,
        items: [
          {
            id: 'la-1',
            tenantId: 'tenant-1',
            tenantName: 'Acme Corp',
            propertyName: 'Downtown Office',
            expirationDate: '2024-02-15',
            daysUntilExpiration: 20,
          },
          {
            id: 'la-2',
            tenantId: 'tenant-2',
            tenantName: 'Beta Inc',
            propertyName: 'Retail Plaza',
            expirationDate: '2024-02-28',
            daysUntilExpiration: 33,
          },
        ],
      },
      pendingReconciliations: [
        {
          id: 'recon-1',
          propertyId: 'prop-1',
          propertyName: 'Downtown Office',
          periodStart: '2024-01-01',
          periodEnd: '2024-03-31',
          status: 'draft',
          createdAt: '2024-01-10T10:00:00Z',
        },
      ],
      overdueDocuments: [
        {
          id: 'la-3',
          documentId: 'doc-1',
          tenantName: 'Gamma LLC',
          propertyName: 'Industrial Park',
          reviewStatus: 'pending',
          createdAt: '2024-01-05T08:00:00Z',
        },
      ],
    };

    it('should return dashboard data successfully', async () => {
      vi.mocked(dashboardService.getDashboardData).mockResolvedValue(mockDashboardData);

      const res = await request(app).get('/api/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockDashboardData);
      expect(dashboardService.getDashboardData).toHaveBeenCalledWith('org-123');
    });

    it('should scope data to the authenticated user organization', async () => {
      vi.mocked(dashboardService.getDashboardData).mockResolvedValue(mockDashboardData);

      await request(app).get('/api/dashboard');

      expect(dashboardService.getDashboardData).toHaveBeenCalledWith('org-123');
    });

    it('should return empty data when no properties exist', async () => {
      const emptyData = {
        metrics: {
          totalProperties: 0,
          totalTenants: 0,
          occupancyRate: 0,
          totalLeasableArea: 0,
        },
        leaseExpirations: {
          within30Days: 0,
          within60Days: 0,
          within90Days: 0,
          items: [],
        },
        pendingReconciliations: [],
        overdueDocuments: [],
      };

      vi.mocked(dashboardService.getDashboardData).mockResolvedValue(emptyData);

      const res = await request(app).get('/api/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data.metrics.totalProperties).toBe(0);
      expect(res.body.data.leaseExpirations.items).toHaveLength(0);
      expect(res.body.data.pendingReconciliations).toHaveLength(0);
      expect(res.body.data.overdueDocuments).toHaveLength(0);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(dashboardService.getDashboardData).mockRejectedValue(
        new Error('Database connection failed')
      );

      const res = await request(app).get('/api/dashboard');

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

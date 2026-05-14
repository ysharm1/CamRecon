import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../db', () => {
  const mockDb: any = vi.fn((tableName: string) => mockDb._table(tableName));
  mockDb._table = (tableName: string) => ({
    where: vi.fn().mockReturnThis(),
    first: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn(),
    orderBy: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    sum: vi.fn().mockReturnThis(),
  });
  mockDb.default = mockDb;
  return { default: mockDb };
});

// Mock portal service
vi.mock('../portal/portal.service', () => ({
  getTenantBalance: vi.fn(),
}));

import db from '../db';
import { createCheckoutSession, getTenantPayments } from './payments.service';

describe('payments.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure STRIPE_SECRET_KEY is not set (demo mode)
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe('createCheckoutSession', () => {
    it('should reject non-positive amounts', async () => {
      await expect(createCheckoutSession('tenant-1', 0, 'test')).rejects.toThrow(
        'Payment amount must be positive'
      );
      await expect(createCheckoutSession('tenant-1', -100, 'test')).rejects.toThrow(
        'Payment amount must be positive'
      );
    });

    it('should reject if tenant not found', async () => {
      const mockWhere = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) });
      (db as any).mockReturnValue({ where: mockWhere });

      await expect(createCheckoutSession('nonexistent', 5000, 'test')).rejects.toThrow(
        'Tenant not found'
      );
    });

    it('should create a demo checkout session when Stripe is not configured', async () => {
      // Mock tenant lookup
      const mockFirst = vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'Test Tenant' });
      const mockWhere = vi.fn().mockReturnValue({ first: mockFirst });

      // Mock payment insert
      const mockReturning = vi.fn().mockResolvedValue([{
        id: 'payment-1',
        stripe_session_id: 'demo_session_123',
      }]);
      const mockInsert = vi.fn().mockReturnValue({ returning: mockReturning });

      let callCount = 0;
      (db as any).mockImplementation((table: string) => {
        callCount++;
        if (table === 'tenants') {
          return { where: mockWhere };
        }
        if (table === 'payments') {
          return { insert: mockInsert };
        }
        return { where: mockWhere };
      });

      const result = await createCheckoutSession('tenant-1', 5000, 'CAM True-Up');

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('checkoutUrl');
      expect(result).toHaveProperty('paymentId');
      expect(result.checkoutUrl).toContain('demo.stripe.com');
      expect(result.paymentId).toBe('payment-1');
    });
  });

  describe('getTenantPayments', () => {
    it('should return formatted payment history', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          amount_cents: 5000,
          status: 'completed',
          description: 'CAM True-Up',
          created_at: '2024-01-15T00:00:00Z',
        },
        {
          id: 'pay-2',
          amount_cents: 3000,
          status: 'pending',
          description: null,
          created_at: '2024-01-20T00:00:00Z',
        },
      ];

      const mockSelect = vi.fn().mockResolvedValue(mockPayments);
      const mockOrderBy = vi.fn().mockReturnValue({ select: mockSelect });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      (db as any).mockReturnValue({ where: mockWhere });

      const result = await getTenantPayments('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'pay-1',
        amountCents: 5000,
        status: 'completed',
        description: 'CAM True-Up',
        createdAt: '2024-01-15T00:00:00Z',
      });
      expect(result[1]).toEqual({
        id: 'pay-2',
        amountCents: 3000,
        status: 'pending',
        description: null,
        createdAt: '2024-01-20T00:00:00Z',
      });
    });
  });
});

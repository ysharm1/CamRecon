import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// Mock the db module
vi.mock('../db', () => {
  const mockDb = vi.fn();
  (mockDb as any).raw = vi.fn((sql: string) => sql);
  return { default: mockDb };
});

import db from '../db';
import {
  createPortalToken,
  verifyPortalToken,
  getTenantBalance,
  revokePortalToken,
} from './portal.service';

const mockedDb = vi.mocked(db);

describe('portal.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPortalToken', () => {
    it('should throw TENANT_NOT_FOUND when tenant does not exist', async () => {
      const whereChain = { first: vi.fn().mockResolvedValue(null) };
      mockedDb.mockReturnValue({ where: vi.fn().mockReturnValue(whereChain) } as any);

      await expect(createPortalToken('nonexistent-id', 30)).rejects.toMatchObject({
        statusCode: 404,
        code: 'TENANT_NOT_FOUND',
      });
    });

    it('should create a token and return id, raw token, and expiry', async () => {
      const mockTenant = { id: 'tenant-1', name: 'Test Tenant' };
      const mockInsertResult = { id: 'token-id-1', expires_at: '2025-02-15T00:00:00Z' };

      const tenantsWhere = { first: vi.fn().mockResolvedValue(mockTenant) };
      const returningFn = vi.fn().mockResolvedValue([mockInsertResult]);
      const insertFn = vi.fn().mockReturnValue({ returning: returningFn });

      mockedDb.mockImplementation(((table: string) => {
        if (table === 'tenants') {
          return { where: vi.fn().mockReturnValue(tenantsWhere) };
        }
        if (table === 'portal_tokens') {
          return { insert: insertFn };
        }
        return {};
      }) as any);

      const result = await createPortalToken('tenant-1', 30);

      expect(result.id).toBe('token-id-1');
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes hex = 64 chars
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify the token stored in DB is a hash, not the raw token
      const insertedData = insertFn.mock.calls[0][0];
      expect(insertedData.token).not.toBe(result.token);
      // Verify it's the SHA-256 hash of the raw token
      const expectedHash = createHash('sha256').update(result.token).digest('hex');
      expect(insertedData.token).toBe(expectedHash);
    });

    it('should set is_revoked to false on new tokens', async () => {
      const mockTenant = { id: 'tenant-1', name: 'Test Tenant' };
      const mockInsertResult = { id: 'token-id-1', expires_at: '2025-02-15T00:00:00Z' };

      const returningFn = vi.fn().mockResolvedValue([mockInsertResult]);
      const insertFn = vi.fn().mockReturnValue({ returning: returningFn });

      mockedDb.mockImplementation(((table: string) => {
        if (table === 'tenants') {
          return { where: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(mockTenant) }) };
        }
        if (table === 'portal_tokens') {
          return { insert: insertFn };
        }
        return {};
      }) as any);

      await createPortalToken('tenant-1', 30);

      const insertedData = insertFn.mock.calls[0][0];
      expect(insertedData.is_revoked).toBe(false);
    });
  });

  describe('verifyPortalToken', () => {
    it('should throw INVALID_PORTAL_TOKEN when token not found', async () => {
      const whereChain = { first: vi.fn().mockResolvedValue(null) };
      mockedDb.mockReturnValue({ where: vi.fn().mockReturnValue(whereChain) } as any);

      await expect(verifyPortalToken('invalid-token')).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_PORTAL_TOKEN',
      });
    });

    it('should throw EXPIRED_PORTAL_TOKEN when token is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockPortalToken = {
        tenant_id: 'tenant-1',
        expires_at: pastDate.toISOString(),
        is_revoked: false,
      };

      const whereChain = { first: vi.fn().mockResolvedValue(mockPortalToken) };
      mockedDb.mockReturnValue({ where: vi.fn().mockReturnValue(whereChain) } as any);

      await expect(verifyPortalToken('some-token')).rejects.toMatchObject({
        statusCode: 401,
        code: 'EXPIRED_PORTAL_TOKEN',
      });
    });

    it('should return tenant info for a valid token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const mockPortalToken = {
        tenant_id: 'tenant-1',
        expires_at: futureDate.toISOString(),
        is_revoked: false,
      };

      const mockTenantJoin = {
        tenant_id: 'tenant-1',
        tenant_name: 'Acme Corp',
        property_id: 'prop-1',
        property_name: 'Riverside Plaza',
        suite_number: '200',
      };

      mockedDb.mockImplementation(((table: string) => {
        if (table === 'portal_tokens') {
          return { where: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(mockPortalToken) }) };
        }
        if (table === 'tenants as t') {
          return {
            join: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  first: vi.fn().mockResolvedValue(mockTenantJoin),
                }),
              }),
            }),
          };
        }
        return {};
      }) as any);

      const result = await verifyPortalToken('valid-token');

      expect(result.tenantId).toBe('tenant-1');
      expect(result.tenantName).toBe('Acme Corp');
      expect(result.propertyId).toBe('prop-1');
      expect(result.propertyName).toBe('Riverside Plaza');
      expect(result.suiteNumber).toBe('200');
    });

    it('should hash the token before database lookup', async () => {
      const rawToken = 'my-raw-token';
      const expectedHash = createHash('sha256').update(rawToken).digest('hex');

      const whereFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) });
      mockedDb.mockReturnValue({ where: whereFn } as any);

      try {
        await verifyPortalToken(rawToken);
      } catch {
        // Expected to throw
      }

      expect(whereFn).toHaveBeenCalledWith({ token: expectedHash, is_revoked: false });
    });
  });

  describe('getTenantBalance', () => {
    it('should return zero balances when no allocations exist', async () => {
      const mockResult = {
        total_variance: 0,
        total_estimated: 0,
        total_actual: 0,
      };

      mockedDb.mockReturnValue({
        where: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockResult),
          }),
        }),
      } as any);

      const result = await getTenantBalance('tenant-1');

      expect(result.outstandingBalanceCents).toBe(0);
      expect(result.totalEstimatedCents).toBe(0);
      expect(result.totalActualCents).toBe(0);
      expect(result.totalVarianceCents).toBe(0);
    });

    it('should return summed values from allocations', async () => {
      const mockResult = {
        total_variance: 15000,
        total_estimated: 100000,
        total_actual: 115000,
      };

      mockedDb.mockReturnValue({
        where: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockResult),
          }),
        }),
      } as any);

      const result = await getTenantBalance('tenant-1');

      expect(result.outstandingBalanceCents).toBe(15000);
      expect(result.totalEstimatedCents).toBe(100000);
      expect(result.totalActualCents).toBe(115000);
      expect(result.totalVarianceCents).toBe(15000);
    });
  });

  describe('revokePortalToken', () => {
    it('should throw TOKEN_NOT_FOUND when token does not exist', async () => {
      mockedDb.mockReturnValue({
        where: vi.fn().mockReturnValue({
          update: vi.fn().mockResolvedValue(0),
        }),
      } as any);

      await expect(revokePortalToken('nonexistent-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'TOKEN_NOT_FOUND',
      });
    });

    it('should revoke a token successfully', async () => {
      mockedDb.mockReturnValue({
        where: vi.fn().mockReturnValue({
          update: vi.fn().mockResolvedValue(1),
        }),
      } as any);

      await expect(revokePortalToken('token-id-1')).resolves.toBeUndefined();
    });
  });
});

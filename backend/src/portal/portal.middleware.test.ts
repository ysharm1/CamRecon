import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

// Mock the db module
vi.mock('../db', () => {
  const mockDb = vi.fn();
  return { default: mockDb };
});

import db from '../db';
import { portalAuthenticate } from './portal.middleware';

const mockedDb = vi.mocked(db);

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response {
  return {} as Response;
}

describe('portalAuthenticate middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  it('should call next with error when no token is provided', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    await portalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'MISSING_PORTAL_TOKEN',
      })
    );
  });

  it('should extract token from Authorization Bearer header', async () => {
    const rawToken = 'test-portal-token-123';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const req = createMockRequest({
      headers: { authorization: 'Bearer test-portal-token-123' },
    });
    const res = createMockResponse();

    const whereFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) });
    mockedDb.mockReturnValue({ where: whereFn } as any);

    await portalAuthenticate(req, res, next);

    // Should have looked up the hashed token
    expect(whereFn).toHaveBeenCalledWith({ token: tokenHash, is_revoked: false });
  });

  it('should extract token from query parameter', async () => {
    const rawToken = 'query-token-456';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const req = createMockRequest({
      query: { token: 'query-token-456' },
    });
    const res = createMockResponse();

    const whereFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) });
    mockedDb.mockReturnValue({ where: whereFn } as any);

    await portalAuthenticate(req, res, next);

    expect(whereFn).toHaveBeenCalledWith({ token: tokenHash, is_revoked: false });
  });

  it('should call next with error when token is not found in DB', async () => {
    const req = createMockRequest({
      headers: { authorization: 'Bearer invalid-token' },
    });
    const res = createMockResponse();

    mockedDb.mockReturnValue({
      where: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
    } as any);

    await portalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'INVALID_PORTAL_TOKEN',
      })
    );
  });

  it('should call next with error when token is expired', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const req = createMockRequest({
      headers: { authorization: 'Bearer expired-token' },
    });
    const res = createMockResponse();

    mockedDb.mockReturnValue({
      where: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          tenant_id: 'tenant-1',
          expires_at: pastDate.toISOString(),
        }),
      }),
    } as any);

    await portalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'EXPIRED_PORTAL_TOKEN',
      })
    );
  });

  it('should attach portalTenant to request and call next() on valid token', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const req = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = createMockResponse();

    const mockTenant = {
      id: 'tenant-1',
      property_id: 'prop-1',
      name: 'Acme Corp',
    };

    mockedDb.mockImplementation(((table: string) => {
      if (table === 'portal_tokens') {
        return {
          where: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({
              tenant_id: 'tenant-1',
              expires_at: futureDate.toISOString(),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          where: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockTenant),
          }),
        };
      }
      return {};
    }) as any);

    await portalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(); // called with no arguments = success
    expect(req.portalTenant).toEqual({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      tenantName: 'Acme Corp',
    });
  });

  it('should call next with error when tenant not found for valid token', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const req = createMockRequest({
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = createMockResponse();

    mockedDb.mockImplementation(((table: string) => {
      if (table === 'portal_tokens') {
        return {
          where: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({
              tenant_id: 'tenant-1',
              expires_at: futureDate.toISOString(),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          where: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        };
      }
      return {};
    }) as any);

    await portalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        code: 'TENANT_NOT_FOUND',
      })
    );
  });

  it('should prefer Authorization header over query parameter', async () => {
    const headerToken = 'header-token';
    const queryToken = 'query-token';
    const headerHash = createHash('sha256').update(headerToken).digest('hex');

    const req = createMockRequest({
      headers: { authorization: `Bearer ${headerToken}` },
      query: { token: queryToken },
    });
    const res = createMockResponse();

    const whereFn = vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) });
    mockedDb.mockReturnValue({ where: whereFn } as any);

    await portalAuthenticate(req, res, next);

    // Should use the header token, not the query token
    expect(whereFn).toHaveBeenCalledWith({ token: headerHash, is_revoked: false });
  });
});

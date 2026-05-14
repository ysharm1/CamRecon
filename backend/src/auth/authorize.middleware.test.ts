import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authorize } from './authorize.middleware';
import { AuthUser } from './types';

// Mock the db module
vi.mock('../db', () => ({
  default: vi.fn(),
}));

function createMockReq(user?: AuthUser): Partial<Request> {
  return { user };
}

function createMockRes(): Partial<Response> {
  return {};
}

describe('authorize middleware', () => {
  const adminUser: AuthUser = {
    userId: 'user-1',
    email: 'admin@test.com',
    role: 'admin',
    organizationId: 'org-1',
    firstName: 'Admin',
    lastName: 'User',
  };

  const readOnlyUser: AuthUser = {
    userId: 'user-2',
    email: 'viewer@test.com',
    role: 'read_only',
    organizationId: 'org-1',
    firstName: 'Viewer',
    lastName: 'User',
  };

  const accountantUser: AuthUser = {
    userId: 'user-3',
    email: 'accountant@test.com',
    role: 'accountant',
    organizationId: 'org-1',
    firstName: 'Accountant',
    lastName: 'User',
  };

  it('allows access when user role is in allowed roles', () => {
    const middleware = authorize('admin', 'property_manager');
    const req = createMockReq(adminUser) as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('denies access when user role is not in allowed roles', () => {
    const middleware = authorize('admin', 'property_manager');
    const req = createMockReq(readOnlyUser) as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    expect(() => middleware(req, res, next)).toThrow('Access denied');
  });

  it('throws when no user is attached to request', () => {
    const middleware = authorize('admin');
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    expect(() => middleware(req, res, next)).toThrow('Authentication is required');
  });

  it('allows accountant access when accountant role is specified', () => {
    const middleware = authorize('admin', 'accountant');
    const req = createMockReq(accountantUser) as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('denies accountant access to admin-only routes', () => {
    const middleware = authorize('admin');
    const req = createMockReq(accountantUser) as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    expect(() => middleware(req, res, next)).toThrow('Access denied');
  });
});

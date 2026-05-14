import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from './auth.middleware';
import { generateAccessToken } from './auth.service';

// Mock the db module
vi.mock('../db', () => ({
  default: vi.fn(),
}));

function createMockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers };
}

function createMockRes(): Partial<Response> {
  return {};
}

describe('authenticate middleware', () => {
  it('attaches user to request when valid token is provided', () => {
    const token = generateAccessToken({
      id: 'user-123',
      email: 'test@example.com',
      role: 'admin',
      organization_id: 'org-456',
    });

    const req = createMockReq({ authorization: `Bearer ${token}` }) as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    authenticate(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user-123');
    expect(req.user!.email).toBe('test@example.com');
    expect(req.user!.role).toBe('admin');
    expect(req.user!.organizationId).toBe('org-456');
    expect(next).toHaveBeenCalled();
  });

  it('throws when no authorization header is present', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    expect(() => authenticate(req, res, next)).toThrow('Authorization header is required');
  });

  it('throws when authorization header format is invalid', () => {
    const req = createMockReq({ authorization: 'InvalidFormat token123' }) as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    expect(() => authenticate(req, res, next)).toThrow(
      'Authorization header must be in format: Bearer <token>'
    );
  });

  it('throws when token is invalid', () => {
    const req = createMockReq({ authorization: 'Bearer invalid-token' }) as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    expect(() => authenticate(req, res, next)).toThrow('Invalid or expired access token');
  });
});

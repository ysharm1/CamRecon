import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from './requestId';

function createMockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers };
}

function createMockRes(): Partial<Response> {
  return {
    setHeader: vi.fn(),
  };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID request ID when none is provided', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it('uses the X-Request-ID header if provided', () => {
    const customId = 'custom-request-id-123';
    const req = createMockReq({ 'x-request-id': customId }) as Request;
    const res = createMockRes() as Response;
    const next: NextFunction = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe(customId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', customId);
    expect(next).toHaveBeenCalled();
  });
});

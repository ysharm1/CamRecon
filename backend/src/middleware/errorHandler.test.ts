import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { errorHandler, AppError } from './errorHandler';

function createMockReq(): Partial<Request> {
  return { requestId: 'test-request-id' };
}

function createMockRes(): Partial<Response> & { _json: unknown; _status: number } {
  const res: any = {
    _json: null,
    _status: 200,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._json = body;
      return res;
    },
  };
  return res;
}

describe('errorHandler', () => {
  it('handles ZodError with 400 status and validation details', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    let zodError: ZodError;
    try {
      schema.parse({ name: 123, age: 'not a number' });
    } catch (err) {
      zodError = err as ZodError;
    }

    const req = createMockReq() as Request;
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    errorHandler(zodError!, req, res as unknown as Response, next);

    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
        ]),
      },
    });
  });

  it('handles AppError with custom status code and code', () => {
    const appError = new AppError(404, 'NOT_FOUND', 'Resource not found');

    const req = createMockReq() as Request;
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    errorHandler(appError, req, res as unknown as Response, next);

    expect(res._status).toBe(404);
    expect(res._json).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  });

  it('handles AppError with details', () => {
    const appError = new AppError(422, 'INVALID_DATA', 'Data is invalid', { field: 'email' });

    const req = createMockReq() as Request;
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    errorHandler(appError, req, res as unknown as Response, next);

    expect(res._status).toBe(422);
    expect(res._json).toEqual({
      error: {
        code: 'INVALID_DATA',
        message: 'Data is invalid',
        details: { field: 'email' },
      },
    });
  });

  it('handles unexpected errors with 500 status', () => {
    const unexpectedError = new Error('Something broke');

    const req = createMockReq() as Request;
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    errorHandler(unexpectedError, req, res as unknown as Response, next);

    expect(res._status).toBe(500);
    expect(res._json).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
});

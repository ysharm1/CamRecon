import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from './validate';

function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  };
}

describe('validateBody', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().min(0),
  });

  it('passes valid body and calls next', () => {
    const req = createMockReq({ body: { name: 'Alice', age: 30 } }) as Request;
    const res = {} as Response;
    const next: NextFunction = vi.fn();

    validateBody(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('calls next with ZodError for invalid body', () => {
    const req = createMockReq({ body: { name: 123 } }) as Request;
    const res = {} as Response;
    const next: NextFunction = vi.fn();

    validateBody(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });

  it('strips unknown fields with strict schema', () => {
    const strictSchema = z.object({ name: z.string() }).strict();
    const req = createMockReq({ body: { name: 'Bob', extra: 'field' } }) as Request;
    const res = {} as Response;
    const next: NextFunction = vi.fn();

    validateBody(strictSchema)(req, res, next);

    // strict schema rejects unknown keys
    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });
});

describe('validateQuery', () => {
  const schema = z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  });

  it('passes valid query and calls next', () => {
    const req = createMockReq({ query: { page: '1', limit: '10' } as any }) as Request;
    const res = {} as Response;
    const next: NextFunction = vi.fn();

    validateQuery(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('validateParams', () => {
  const schema = z.object({
    id: z.string().uuid(),
  });

  it('passes valid params and calls next', () => {
    const req = createMockReq({
      params: { id: '550e8400-e29b-41d4-a716-446655440000' } as any,
    }) as Request;
    const res = {} as Response;
    const next: NextFunction = vi.fn();

    validateParams(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with ZodError for invalid params', () => {
    const req = createMockReq({ params: { id: 'not-a-uuid' } as any }) as Request;
    const res = {} as Response;
    const next: NextFunction = vi.fn();

    validateParams(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from './auth.service';

// Mock the db module to avoid actual database calls
vi.mock('../db', () => ({
  default: vi.fn(),
}));

describe('auth.service', () => {
  describe('hashPassword / verifyPassword', () => {
    it('hashes a password and verifies it correctly', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$/);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('rejects an incorrect password', async () => {
      const hash = await hashPassword('correctPassword');
      const isValid = await verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateAccessToken / verifyAccessToken', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'admin' as const,
      organization_id: 'org-456',
    };

    it('generates a valid access token with correct payload', () => {
      const token = generateAccessToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const payload = verifyAccessToken(token);
      expect(payload.userId).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
      expect(payload.role).toBe('admin');
      expect(payload.organizationId).toBe('org-456');
      expect(payload.type).toBe('access');
    });

    it('throws on invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow('Invalid or expired access token');
    });

    it('throws on expired token', () => {
      // Create a token that's already expired
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        organizationId: 'org-456',
        type: 'access',
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-jwt-secret', {
        expiresIn: -10,
      });

      expect(() => verifyAccessToken(token)).toThrow('Invalid or expired access token');
    });
  });

  describe('generateRefreshToken / verifyRefreshToken', () => {
    it('generates a valid refresh token', () => {
      const token = generateRefreshToken('user-123');
      expect(token).toBeDefined();

      const payload = verifyRefreshToken(token);
      expect(payload.userId).toBe('user-123');
      expect(payload.type).toBe('refresh');
    });

    it('throws on revoked refresh token', () => {
      const token = generateRefreshToken('user-123');
      revokeRefreshToken(token);

      expect(() => verifyRefreshToken(token)).toThrow('Refresh token has been revoked');
    });

    it('throws on invalid refresh token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow('Refresh token has been revoked');
    });
  });

  describe('revokeRefreshToken', () => {
    it('revokes a token so it cannot be used again', () => {
      const token = generateRefreshToken('user-456');

      // Should work before revocation
      expect(() => verifyRefreshToken(token)).not.toThrow();

      revokeRefreshToken(token);

      // Should fail after revocation
      expect(() => verifyRefreshToken(token)).toThrow('Refresh token has been revoked');
    });
  });
});

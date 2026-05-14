import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../db';
import { AppError } from '../middleware/errorHandler';
import {
  AccessTokenPayload,
  AuthUser,
  RefreshTokenPayload,
  TokenResponse,
  UserRole,
} from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret';
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

// In-memory store for refresh tokens (demo purposes)
const refreshTokenStore = new Set<string>();

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(user: {
  id: string;
  email: string;
  role: UserRole;
  organization_id: string;
}): string {
  const payload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
    type: 'access',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = {
    userId,
    type: 'refresh',
  };
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  refreshTokenStore.add(token);
  return token;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
    if (payload.type !== 'access') {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid token type');
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  if (!refreshTokenStore.has(token)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Refresh token has been revoked');
  }
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (payload.type !== 'refresh') {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid token type');
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
  }
}

export function revokeRefreshToken(token: string): void {
  refreshTokenStore.delete(token);
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const user = await db('users').where({ email, is_active: true }).first();
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Update last login
  await db('users').where({ id: user.id }).update({ last_login_at: new Date() });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

export async function refresh(refreshToken: string): Promise<TokenResponse> {
  const payload = verifyRefreshToken(refreshToken);

  // Revoke old refresh token (rotation)
  revokeRefreshToken(refreshToken);

  const user = await db('users').where({ id: payload.userId, is_active: true }).first();
  if (!user) {
    throw new AppError(401, 'INVALID_TOKEN', 'User not found or inactive');
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user.id);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await db('users').where({ id: userId, is_active: true }).first();
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
    firstName: user.first_name,
    lastName: user.last_name,
  };
}

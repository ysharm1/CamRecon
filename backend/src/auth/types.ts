/**
 * Authentication and authorization types.
 */

export type UserRole = 'admin' | 'property_manager' | 'accountant' | 'read_only';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
  firstName: string;
  lastName: string;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

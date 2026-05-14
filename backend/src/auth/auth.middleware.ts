import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { verifyAccessToken } from './auth.service';
import { AuthUser } from './types';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware.
 * Validates the JWT access token from the Authorization header
 * and attaches the user context to the request.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError(401, 'MISSING_TOKEN', 'Authorization header is required');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AppError(401, 'INVALID_TOKEN', 'Authorization header must be in format: Bearer <token>');
  }

  const token = parts[1];
  const payload = verifyAccessToken(token);

  req.user = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
    firstName: '', // Not stored in token, populated if needed
    lastName: '',
  };

  next();
}

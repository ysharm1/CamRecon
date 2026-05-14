import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { UserRole } from './types';

/**
 * Role-based authorization middleware.
 * Takes an array of allowed roles and rejects requests from users
 * whose role is not in the allowed list.
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
}

/**
 * Property-level scoping middleware.
 * Ensures the user has access to the property specified in the request.
 * Admins have access to all properties in their organization.
 * Other roles are checked against property ownership within their organization.
 */
export function authorizeProperty(propertyIdParam: string = 'propertyId') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const propertyId = req.params[propertyIdParam] || req.body?.propertyId;

    if (!propertyId) {
      // No property context required for this request
      next();
      return;
    }

    // Import db here to avoid circular dependencies
    const { default: db } = await import('../db');

    const property = await db('properties')
      .where({ id: propertyId, owner_id: req.user.organizationId })
      .first();

    if (!property) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You do not have access to this property'
      );
    }

    next();
  };
}

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { notificationsService } from './notifications.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/notifications
 * List notifications for the authenticated user.
 * Returns unread first, then ordered by created_at descending.
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      const notifications = await notificationsService.listNotifications(req.user.userId);

      res.json({ data: notifications });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read.
 */
router.put(
  '/:id/read',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      const { id } = req.params;

      const notification = await notificationsService.markAsRead(id, req.user.userId);

      if (!notification) {
        throw new AppError(404, 'NOT_FOUND', 'Notification not found');
      }

      res.json({ data: notification });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

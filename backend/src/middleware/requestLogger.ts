import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Middleware that logs each request with structured fields:
 * request ID, user ID, HTTP method, URL, status code, and duration.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const userId = (req as any).user?.id || 'anonymous';

    logger.info({
      requestId: req.requestId,
      userId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
    }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
}

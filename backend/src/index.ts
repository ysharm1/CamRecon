import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import {
  logger,
  requestIdMiddleware,
  requestLoggerMiddleware,
  errorHandler,
} from './middleware';
import { authRoutes } from './auth';
import { documentRoutes } from './documents';
import { auditRoutes } from './audit';
import { camRoutes } from './cam';
import { abstractionRoutes } from './abstraction';
import { searchRoutes } from './search';
import { reportRoutes } from './reports';
import { dashboardRoutes } from './dashboard';
import { activityRoutes } from './activity';
import { notificationRoutes } from './notifications';
import { propertyRoutes } from './properties';
import { tenantRoutes } from './tenants';
import { integrationsRoutes, docusignRoutes, quickbooksRoutes } from './integrations';
import { portalRoutes, ownerPortalRoutes } from './portal';
import { paymentRoutes } from './payments';
import { billingRoutes } from './billing';
import { importRoutes } from './import';
import { aiRoutes } from './ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for SPA compatibility

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 min per IP
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 uploads per hour per IP
  message: { error: { code: 'RATE_LIMITED', message: 'Upload limit reached. Try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Core middleware
app.use(generalLimiter);
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/documents', uploadLimiter, documentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reconciliations', camRoutes);
app.use('/api/abstractions', abstractionRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/integrations/docusign', docusignRoutes);
app.use('/api/integrations/quickbooks', quickbooksRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/portal/owner', ownerPortalRoutes);
app.use('/api', paymentRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/import', importRoutes);
app.use('/api/ai', aiRoutes);

// Global error handler (must be registered last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, `Backend server running on port ${PORT}`);
});

export default app;

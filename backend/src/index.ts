import express from 'express';
import cors from 'cors';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Core middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
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

// Global error handler (must be registered last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, `Backend server running on port ${PORT}`);
});

export default app;

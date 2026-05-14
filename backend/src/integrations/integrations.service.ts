import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { AppError } from '../middleware';

export interface IntegrationRecord {
  id: string;
  organization_id: string;
  provider: string;
  status: 'connected' | 'disconnected';
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectInput {
  organizationId: string;
  provider: 'docusign' | 'quickbooks';
  credentials: {
    access_token: string;
    refresh_token: string;
    expires_at: string;
  };
  config?: Record<string, unknown>;
}

export interface IntegrationStatus {
  provider: string;
  status: 'connected' | 'disconnected';
  lastSyncAt: string | null;
  config: Record<string, unknown>;
}

/**
 * Get all integrations for an organization.
 */
async function listIntegrations(organizationId: string): Promise<IntegrationRecord[]> {
  return db('integrations')
    .where('organization_id', organizationId)
    .orderBy('provider', 'asc');
}

/**
 * Get the status of a specific integration provider.
 */
async function getStatus(organizationId: string, provider: string): Promise<IntegrationStatus> {
  const integration = await db('integrations')
    .where({ organization_id: organizationId, provider })
    .first();

  if (!integration) {
    return {
      provider,
      status: 'disconnected',
      lastSyncAt: null,
      config: {},
    };
  }

  return {
    provider: integration.provider,
    status: integration.status,
    lastSyncAt: integration.last_sync_at,
    config: integration.config || {},
  };
}

/**
 * Connect an integration (store OAuth tokens after successful callback).
 */
async function connect(input: ConnectInput): Promise<IntegrationRecord> {
  const { organizationId, provider, credentials, config } = input;

  // Upsert: if integration record exists, update it; otherwise create
  const existing = await db('integrations')
    .where({ organization_id: organizationId, provider })
    .first();

  if (existing) {
    const [updated] = await db('integrations')
      .where({ id: existing.id })
      .update({
        status: 'connected',
        credentials: JSON.stringify(credentials),
        config: JSON.stringify(config || {}),
        updated_at: db.fn.now(),
      })
      .returning('*');
    return updated;
  }

  const [record] = await db('integrations')
    .insert({
      id: uuidv4(),
      organization_id: organizationId,
      provider,
      status: 'connected',
      credentials: JSON.stringify(credentials),
      config: JSON.stringify(config || {}),
    })
    .returning('*');

  return record;
}

/**
 * Disconnect an integration (clear credentials, set status to disconnected).
 */
async function disconnect(organizationId: string, provider: string): Promise<void> {
  const integration = await db('integrations')
    .where({ organization_id: organizationId, provider })
    .first();

  if (!integration) {
    throw new AppError(404, 'INTEGRATION_NOT_FOUND', `Integration '${provider}' not found`);
  }

  await db('integrations')
    .where({ id: integration.id })
    .update({
      status: 'disconnected',
      credentials: JSON.stringify({}),
      updated_at: db.fn.now(),
    });
}

/**
 * Update the last_sync_at timestamp for an integration.
 */
async function updateLastSync(organizationId: string, provider: string): Promise<void> {
  await db('integrations')
    .where({ organization_id: organizationId, provider })
    .update({
      last_sync_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}

/**
 * Get stored credentials for an integration.
 */
async function getCredentials(organizationId: string, provider: string): Promise<Record<string, unknown> | null> {
  const integration = await db('integrations')
    .where({ organization_id: organizationId, provider, status: 'connected' })
    .first();

  if (!integration) {
    return null;
  }

  return integration.credentials;
}

export const integrationsService = {
  listIntegrations,
  getStatus,
  connect,
  disconnect,
  updateLastSync,
  getCredentials,
};

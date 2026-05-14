import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('integrations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('provider').notNullable(); // 'docusign' | 'quickbooks'
    table.enum('status', ['connected', 'disconnected']).notNullable().defaultTo('disconnected');
    table.jsonb('credentials').defaultTo('{}'); // encrypted tokens: access_token, refresh_token, expires_at
    table.jsonb('config').defaultTo('{}'); // provider-specific config
    table.timestamp('last_sync_at');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.unique(['organization_id', 'provider']);
  });

  await knex.schema.alterTable('integrations', (table) => {
    table.index('organization_id', 'idx_integrations_organization_id');
    table.index('provider', 'idx_integrations_provider');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('integrations');
}

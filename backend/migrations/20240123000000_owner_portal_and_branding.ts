import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add branding columns to organizations table
  await knex.schema.alterTable('organizations', (table) => {
    table.string('logo_url').nullable();
    table.string('primary_color').defaultTo('#4f46e5');
    table.string('report_header').nullable();
  });

  // Add portal_type and property_ids to portal_tokens for owner tokens
  await knex.schema.alterTable('portal_tokens', (table) => {
    table.enum('portal_type', ['tenant', 'owner']).defaultTo('tenant').notNullable();
    table.jsonb('property_ids').nullable(); // Array of property IDs for owner tokens
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('organizations', (table) => {
    table.dropColumn('logo_url');
    table.dropColumn('primary_color');
    table.dropColumn('report_header');
  });

  await knex.schema.alterTable('portal_tokens', (table) => {
    table.dropColumn('portal_type');
    table.dropColumn('property_ids');
  });
}

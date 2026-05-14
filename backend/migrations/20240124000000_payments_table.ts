import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('amount_cents').notNullable();
    table.string('stripe_session_id').nullable();
    table.string('stripe_payment_intent_id').nullable();
    table.enum('status', ['pending', 'completed', 'failed']).notNullable().defaultTo('pending');
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Indexes
  await knex.schema.alterTable('payments', (table) => {
    table.index('tenant_id', 'idx_payments_tenant_id');
    table.index('stripe_session_id', 'idx_payments_stripe_session_id');
    table.index('status', 'idx_payments_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payments');
}

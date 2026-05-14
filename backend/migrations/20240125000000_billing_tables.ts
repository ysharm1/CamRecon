import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Usage events table
  await knex.schema.createTable('usage_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable();
    table.string('event_type').notNullable();
    table.integer('quantity').notNullable().defaultTo(1);
    table.jsonb('metadata').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  await knex.schema.alterTable('usage_events', (table) => {
    table.index('organization_id', 'idx_usage_events_org_id');
    table.index('event_type', 'idx_usage_events_event_type');
    table.index('created_at', 'idx_usage_events_created_at');
    table.index(['organization_id', 'event_type', 'created_at'], 'idx_usage_events_org_type_date');
  });

  // Subscriptions table
  await knex.schema.createTable('subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable().unique();
    table.string('plan_id').notNullable().defaultTo('starter');
    table.enum('status', ['active', 'cancelled', 'past_due']).notNullable().defaultTo('active');
    table.date('current_period_start').notNullable();
    table.date('current_period_end').notNullable();
    table.string('stripe_subscription_id').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  await knex.schema.alterTable('subscriptions', (table) => {
    table.index('organization_id', 'idx_subscriptions_org_id');
    table.index('stripe_subscription_id', 'idx_subscriptions_stripe_sub_id');
    table.index('status', 'idx_subscriptions_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('usage_events');
}

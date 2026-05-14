import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Organizations table
  await knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.string('slug').notNullable().unique();
    table.jsonb('settings').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.enum('role', ['admin', 'property_manager', 'accountant', 'read_only']).notNullable().defaultTo('read_only');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login_at');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Properties table
  await knex.schema.createTable('properties', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.jsonb('address').notNullable();
    table.integer('total_square_footage').notNullable();
    table.enum('property_type', ['commercial', 'retail', 'industrial', 'mixed']).notNullable();
    table.uuid('owner_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Tenants table
  await knex.schema.createTable('tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.string('contact_email').notNullable();
    table.uuid('property_id').notNullable().references('id').inTable('properties').onDelete('CASCADE');
    table.uuid('lease_id');
    table.string('suite_number').notNullable();
    table.integer('square_footage').notNullable();
    table.enum('status', ['active', 'inactive', 'pending']).notNullable().defaultTo('active');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Documents table
  await knex.schema.createTable('documents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('title').notNullable();
    table.enum('document_type', ['lease', 'invoice', 'report', 'correspondence']).notNullable();
    table.uuid('property_id').notNullable().references('id').inTable('properties').onDelete('CASCADE');
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.string('storage_key').notNullable();
    table.integer('current_version').notNullable().defaultTo(1);
    table.string('mime_type').notNullable();
    table.bigInteger('size_bytes').notNullable();
    table.uuid('uploaded_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Document versions table
  await knex.schema.createTable('document_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('document_id').notNullable().references('id').inTable('documents').onDelete('CASCADE');
    table.integer('version_number').notNullable();
    table.string('storage_key').notNullable();
    table.uuid('uploaded_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('uploaded_at').defaultTo(knex.fn.now()).notNullable();
    table.text('change_description');
    table.bigInteger('size_bytes').notNullable();
    table.string('checksum').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.unique(['document_id', 'version_number']);
  });

  // Lease abstractions table
  await knex.schema.createTable('lease_abstractions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('document_id').notNullable().references('id').inTable('documents').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.date('commencement_date').notNullable();
    table.date('expiration_date').notNullable();
    table.integer('base_rent_cents').notNullable();
    table.jsonb('rent_escalation');
    table.integer('cam_cap_cents');
    table.integer('security_deposit_cents').notNullable();
    table.jsonb('renewal_options').defaultTo('[]');
    table.jsonb('extracted_terms').defaultTo('[]');
    table.float('confidence_score').notNullable();
    table.enum('review_status', ['pending', 'approved', 'needs_correction']).notNullable().defaultTo('pending');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // CAM reconciliations table
  await knex.schema.createTable('cam_reconciliations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('property_id').notNullable().references('id').inTable('properties').onDelete('CASCADE');
    table.date('period_start').notNullable();
    table.date('period_end').notNullable();
    table.integer('total_expenses_cents').notNullable().defaultTo(0);
    table.enum('status', ['draft', 'in_progress', 'completed', 'approved']).notNullable().defaultTo('draft');
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('completed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // CAM line items table
  await knex.schema.createTable('cam_line_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('reconciliation_id').notNullable().references('id').inTable('cam_reconciliations').onDelete('CASCADE');
    table.string('category').notNullable();
    table.text('description');
    table.integer('amount_cents').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Tenant allocations table
  await knex.schema.createTable('tenant_allocations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('reconciliation_id').notNullable().references('id').inTable('cam_reconciliations').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('square_footage').notNullable();
    table.float('share_percentage').notNullable();
    table.integer('estimated_amount_cents').notNullable();
    table.integer('actual_amount_cents').notNullable();
    table.integer('variance_cents').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Audit trail table
  await knex.schema.createTable('audit_trail', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('action').notNullable();
    table.string('entity_type').notNullable();
    table.uuid('entity_id').notNullable();
    table.jsonb('metadata').defaultTo('{}');
    table.string('ip_address');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Activity feed table
  await knex.schema.createTable('activity_feed', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.uuid('property_id').references('id').inTable('properties').onDelete('CASCADE');
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.string('action').notNullable();
    table.text('description').notNullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Notifications table
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('type').notNullable();
    table.string('title').notNullable();
    table.text('message').notNullable();
    table.boolean('is_read').defaultTo(false);
    table.string('link');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Indexes for performance
  await knex.schema.alterTable('tenants', (table) => {
    table.index('property_id', 'idx_tenants_property_id');
  });

  await knex.schema.alterTable('documents', (table) => {
    table.index('property_id', 'idx_documents_property_id');
    table.index('tenant_id', 'idx_documents_tenant_id');
    table.index('document_type', 'idx_documents_document_type');
    table.index('created_at', 'idx_documents_created_at');
  });

  await knex.schema.alterTable('document_versions', (table) => {
    table.index('document_id', 'idx_document_versions_document_id');
  });

  await knex.schema.alterTable('lease_abstractions', (table) => {
    table.index('tenant_id', 'idx_lease_abstractions_tenant_id');
    table.index('document_id', 'idx_lease_abstractions_document_id');
  });

  await knex.schema.alterTable('cam_reconciliations', (table) => {
    table.index('property_id', 'idx_cam_reconciliations_property_id');
    table.index('created_at', 'idx_cam_reconciliations_created_at');
  });

  await knex.schema.alterTable('cam_line_items', (table) => {
    table.index('reconciliation_id', 'idx_cam_line_items_reconciliation_id');
  });

  await knex.schema.alterTable('tenant_allocations', (table) => {
    table.index('reconciliation_id', 'idx_tenant_allocations_reconciliation_id');
    table.index('tenant_id', 'idx_tenant_allocations_tenant_id');
  });

  await knex.schema.alterTable('audit_trail', (table) => {
    table.index('entity_type', 'idx_audit_trail_entity_type');
    table.index('entity_id', 'idx_audit_trail_entity_id');
    table.index('created_at', 'idx_audit_trail_created_at');
  });

  await knex.schema.alterTable('activity_feed', (table) => {
    table.index('property_id', 'idx_activity_feed_property_id');
    table.index('tenant_id', 'idx_activity_feed_tenant_id');
    table.index('created_at', 'idx_activity_feed_created_at');
  });

  await knex.schema.alterTable('notifications', (table) => {
    table.index('user_id', 'idx_notifications_user_id');
    table.index('created_at', 'idx_notifications_created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('activity_feed');
  await knex.schema.dropTableIfExists('audit_trail');
  await knex.schema.dropTableIfExists('tenant_allocations');
  await knex.schema.dropTableIfExists('cam_line_items');
  await knex.schema.dropTableIfExists('cam_reconciliations');
  await knex.schema.dropTableIfExists('lease_abstractions');
  await knex.schema.dropTableIfExists('document_versions');
  await knex.schema.dropTableIfExists('documents');
  await knex.schema.dropTableIfExists('tenants');
  await knex.schema.dropTableIfExists('properties');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('organizations');
}

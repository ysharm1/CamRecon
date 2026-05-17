import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

/**
 * Production seed: creates only the organization and admin user.
 * No fake properties, tenants, or documents — start clean.
 */

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const ADMIN_ID = '22222222-2222-2222-2222-222222222222';

export async function seed(knex: Knex): Promise<void> {
  // Only seed if the organization doesn't already exist (idempotent)
  const existingOrg = await knex('organizations').where({ id: ORG_ID }).first();
  if (existingOrg) {
    return; // Already seeded, don't overwrite real data
  }

  // Organization
  await knex('organizations').insert({
    id: ORG_ID,
    name: 'My Organization',
    slug: 'my-org',
    settings: JSON.stringify({ timezone: 'America/Phoenix', currency: 'USD' }),
  });

  // Admin user
  const adminHash = await bcrypt.hash('admin123', 10);

  await knex('users').insert({
    id: ADMIN_ID,
    organization_id: ORG_ID,
    email: 'admin@camrecon.com',
    password_hash: adminHash,
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    is_active: true,
  });
}

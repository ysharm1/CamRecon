import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

// Fixed UUIDs for demo data to allow repeatable seeding
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const USER_MANAGER_ID = '22222222-2222-2222-2222-222222222223';
const USER_ACCOUNTANT_ID = '22222222-2222-2222-2222-222222222224';
const USER_VIEWER_ID = '22222222-2222-2222-2222-222222222225';
const PROPERTY_1_ID = '33333333-3333-3333-3333-333333333333';
const PROPERTY_2_ID = '44444444-4444-4444-4444-444444444444';
const TENANT_1_ID = '55555555-5555-5555-5555-555555555551';
const TENANT_2_ID = '55555555-5555-5555-5555-555555555552';
const TENANT_3_ID = '55555555-5555-5555-5555-555555555553';
const TENANT_4_ID = '55555555-5555-5555-5555-555555555554';
const TENANT_5_ID = '55555555-5555-5555-5555-555555555555';
const DOC_1_ID = '66666666-6666-6666-6666-666666666661';
const DOC_2_ID = '66666666-6666-6666-6666-666666666662';
const DOC_3_ID = '66666666-6666-6666-6666-666666666663';
const DOC_4_ID = '66666666-6666-6666-6666-666666666664';
const DOC_5_ID = '66666666-6666-6666-6666-666666666665';

/**
 * Helper: returns a date string (YYYY-MM-DD) offset from today by the given number of days.
 */
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Helper: returns an ISO timestamp string offset from now by the given number of days.
 */
function timestampDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function seed(knex: Knex): Promise<void> {
  // Clean existing data in reverse dependency order
  await knex('notifications').del();
  await knex('activity_feed').del();
  await knex('audit_trail').del();
  await knex('tenant_allocations').del();
  await knex('cam_line_items').del();
  await knex('cam_reconciliations').del();
  await knex('lease_abstractions').del();
  await knex('document_versions').del();
  await knex('documents').del();
  await knex('tenants').del();
  await knex('properties').del();
  await knex('users').del();
  await knex('organizations').del();

  // Organization
  await knex('organizations').insert({
    id: ORG_ID,
    name: 'Acme Property Management',
    slug: 'acme-pm',
    settings: JSON.stringify({ timezone: 'America/New_York', currency: 'USD' }),
  });

  // Users with hashed passwords
  const adminHash = await bcrypt.hash('admin123', 10);
  const managerHash = await bcrypt.hash('manager123', 10);
  const accountantHash = await bcrypt.hash('account123', 10);
  const viewerHash = await bcrypt.hash('viewer123', 10);

  await knex('users').insert([
    {
      id: USER_ID,
      organization_id: ORG_ID,
      email: 'admin@acme-pm.com',
      password_hash: adminHash,
      first_name: 'Jane',
      last_name: 'Smith',
      role: 'admin',
      is_active: true,
    },
    {
      id: USER_MANAGER_ID,
      organization_id: ORG_ID,
      email: 'manager@acme-pm.com',
      password_hash: managerHash,
      first_name: 'John',
      last_name: 'Doe',
      role: 'property_manager',
      is_active: true,
    },
    {
      id: USER_ACCOUNTANT_ID,
      organization_id: ORG_ID,
      email: 'accountant@acme-pm.com',
      password_hash: accountantHash,
      first_name: 'Alice',
      last_name: 'Johnson',
      role: 'accountant',
      is_active: true,
    },
    {
      id: USER_VIEWER_ID,
      organization_id: ORG_ID,
      email: 'viewer@acme-pm.com',
      password_hash: viewerHash,
      first_name: 'Bob',
      last_name: 'Williams',
      role: 'read_only',
      is_active: true,
    },
  ]);

  // Properties
  await knex('properties').insert([
    {
      id: PROPERTY_1_ID,
      name: 'Riverside Office Park',
      address: JSON.stringify({
        street: '100 River Road',
        city: 'Hartford',
        state: 'CT',
        zip: '06103',
        country: 'US',
      }),
      total_square_footage: 50000,
      property_type: 'commercial',
      owner_id: ORG_ID,
    },
    {
      id: PROPERTY_2_ID,
      name: 'Downtown Retail Center',
      address: JSON.stringify({
        street: '250 Main Street',
        city: 'New Haven',
        state: 'CT',
        zip: '06510',
        country: 'US',
      }),
      total_square_footage: 30000,
      property_type: 'retail',
      owner_id: ORG_ID,
    },
  ]);

  // Tenants (5 total across 2 properties)
  await knex('tenants').insert([
    {
      id: TENANT_1_ID,
      name: 'TechCorp Solutions',
      contact_email: 'leasing@techcorp.com',
      property_id: PROPERTY_1_ID,
      suite_number: '101',
      square_footage: 15000,
      status: 'active',
    },
    {
      id: TENANT_2_ID,
      name: 'Legal Associates LLP',
      contact_email: 'office@legalassoc.com',
      property_id: PROPERTY_1_ID,
      suite_number: '201',
      square_footage: 10000,
      status: 'active',
    },
    {
      id: TENANT_3_ID,
      name: 'Creative Design Studio',
      contact_email: 'hello@creativedesign.co',
      property_id: PROPERTY_1_ID,
      suite_number: '301',
      square_footage: 8000,
      status: 'active',
    },
    {
      id: TENANT_4_ID,
      name: 'Sunrise Cafe',
      contact_email: 'manager@sunrisecafe.com',
      property_id: PROPERTY_2_ID,
      suite_number: 'G1',
      square_footage: 5000,
      status: 'active',
    },
    {
      id: TENANT_5_ID,
      name: 'Fashion Forward Boutique',
      contact_email: 'info@fashionforward.com',
      property_id: PROPERTY_2_ID,
      suite_number: 'G2',
      square_footage: 7000,
      status: 'active',
    },
  ]);

  // Sample documents (including sample PDFs for abstraction demo)
  await knex('documents').insert([
    {
      id: DOC_1_ID,
      title: 'TechCorp Lease Agreement 2024',
      document_type: 'lease',
      property_id: PROPERTY_1_ID,
      tenant_id: TENANT_1_ID,
      storage_key: 'uploads/sample/techcorp-lease-2024.pdf',
      current_version: 1,
      mime_type: 'application/pdf',
      size_bytes: 2048576,
      uploaded_by: USER_ID,
    },
    {
      id: DOC_2_ID,
      title: 'Legal Associates Lease Agreement 2024',
      document_type: 'lease',
      property_id: PROPERTY_1_ID,
      tenant_id: TENANT_2_ID,
      storage_key: 'uploads/sample/legal-assoc-lease-2024.pdf',
      current_version: 1,
      mime_type: 'application/pdf',
      size_bytes: 1536000,
      uploaded_by: USER_ID,
    },
    {
      id: DOC_3_ID,
      title: 'Riverside Office Park CAM Report Q4 2023',
      document_type: 'report',
      property_id: PROPERTY_1_ID,
      tenant_id: null,
      storage_key: 'uploads/sample/riverside-cam-q4-2023.pdf',
      current_version: 1,
      mime_type: 'application/pdf',
      size_bytes: 512000,
      uploaded_by: USER_ID,
    },
    {
      id: DOC_4_ID,
      title: 'Creative Design Studio Lease Agreement',
      document_type: 'lease',
      property_id: PROPERTY_1_ID,
      tenant_id: TENANT_3_ID,
      storage_key: 'uploads/sample/creative-design-lease.pdf',
      current_version: 1,
      mime_type: 'application/pdf',
      size_bytes: 1820000,
      uploaded_by: USER_MANAGER_ID,
    },
    {
      id: DOC_5_ID,
      title: 'Sunrise Cafe Lease Agreement',
      document_type: 'lease',
      property_id: PROPERTY_2_ID,
      tenant_id: TENANT_4_ID,
      storage_key: 'uploads/sample/sunrise-cafe-lease.pdf',
      current_version: 1,
      mime_type: 'application/pdf',
      size_bytes: 1450000,
      uploaded_by: USER_MANAGER_ID,
    },
  ]);

  // Document versions
  await knex('document_versions').insert([
    {
      document_id: DOC_1_ID,
      version_number: 1,
      storage_key: 'uploads/sample/techcorp-lease-2024.pdf',
      uploaded_by: USER_ID,
      change_description: 'Initial upload',
      size_bytes: 2048576,
      checksum: 'sha256:abc123def456789',
    },
    {
      document_id: DOC_2_ID,
      version_number: 1,
      storage_key: 'uploads/sample/legal-assoc-lease-2024.pdf',
      uploaded_by: USER_ID,
      change_description: 'Initial upload',
      size_bytes: 1536000,
      checksum: 'sha256:def456ghi789012',
    },
    {
      document_id: DOC_3_ID,
      version_number: 1,
      storage_key: 'uploads/sample/riverside-cam-q4-2023.pdf',
      uploaded_by: USER_ID,
      change_description: 'Initial upload',
      size_bytes: 512000,
      checksum: 'sha256:ghi789jkl012345',
    },
    {
      document_id: DOC_4_ID,
      version_number: 1,
      storage_key: 'uploads/sample/creative-design-lease.pdf',
      uploaded_by: USER_MANAGER_ID,
      change_description: 'Initial upload',
      size_bytes: 1820000,
      checksum: 'sha256:jkl012mno345678',
    },
    {
      document_id: DOC_5_ID,
      version_number: 1,
      storage_key: 'uploads/sample/sunrise-cafe-lease.pdf',
      uploaded_by: USER_MANAGER_ID,
      change_description: 'Initial upload',
      size_bytes: 1450000,
      checksum: 'sha256:mno345pqr678901',
    },
  ]);

  // ─── Lease Abstractions ───────────────────────────────────────────────────────
  // Use dynamic dates relative to "now" so the dashboard always shows fresh data.

  // Abstraction 1: TechCorp — approved, expires in ~25 days (within 30-day bucket)
  await knex('lease_abstractions').insert({
    document_id: DOC_1_ID,
    tenant_id: TENANT_1_ID,
    commencement_date: daysFromNow(-365 * 3),
    expiration_date: daysFromNow(25),
    base_rent_cents: 2500000, // $25,000/month
    rent_escalation: JSON.stringify({ type: 'annual_percentage', rate: 3.0 }),
    cam_cap_cents: 800000,
    security_deposit_cents: 5000000,
    renewal_options: JSON.stringify([
      { term_months: 60, notice_days: 180, rent_increase_percent: 5.0 },
    ]),
    extracted_terms: JSON.stringify([
      { key: 'commencement_date', value: daysFromNow(-365 * 3), confidence: 0.95 },
      { key: 'expiration_date', value: daysFromNow(25), confidence: 0.93 },
      { key: 'base_rent', value: '$25,000/month', confidence: 0.91 },
      { key: 'cam_cap', value: '$8,000/month', confidence: 0.88 },
      { key: 'security_deposit', value: '$50,000', confidence: 0.96 },
    ]),
    confidence_score: 0.926,
    review_status: 'approved',
  });

  // Abstraction 2: Legal Associates — approved, expires in ~55 days (within 60-day bucket)
  await knex('lease_abstractions').insert({
    document_id: DOC_2_ID,
    tenant_id: TENANT_2_ID,
    commencement_date: daysFromNow(-365 * 2),
    expiration_date: daysFromNow(55),
    base_rent_cents: 1800000, // $18,000/month
    rent_escalation: JSON.stringify({ type: 'annual_percentage', rate: 2.5 }),
    cam_cap_cents: 600000,
    security_deposit_cents: 3600000,
    renewal_options: JSON.stringify([
      { term_months: 36, notice_days: 120, rent_increase_percent: 4.0 },
    ]),
    extracted_terms: JSON.stringify([
      { key: 'commencement_date', value: daysFromNow(-365 * 2), confidence: 0.94 },
      { key: 'expiration_date', value: daysFromNow(55), confidence: 0.92 },
      { key: 'base_rent', value: '$18,000/month', confidence: 0.89 },
      { key: 'cam_cap', value: '$6,000/month', confidence: 0.87 },
      { key: 'security_deposit', value: '$36,000', confidence: 0.95 },
    ]),
    confidence_score: 0.914,
    review_status: 'approved',
  });

  // Abstraction 3: Creative Design Studio — PENDING review (triggers overdue documents widget)
  // Expires in ~80 days (within 90-day bucket)
  await knex('lease_abstractions').insert({
    document_id: DOC_4_ID,
    tenant_id: TENANT_3_ID,
    commencement_date: daysFromNow(-365),
    expiration_date: daysFromNow(80),
    base_rent_cents: 1200000, // $12,000/month
    rent_escalation: JSON.stringify({ type: 'annual_percentage', rate: 2.0 }),
    cam_cap_cents: null,
    security_deposit_cents: 2400000,
    renewal_options: JSON.stringify([]),
    extracted_terms: JSON.stringify([
      { key: 'commencement_date', value: daysFromNow(-365), confidence: 0.90 },
      { key: 'expiration_date', value: daysFromNow(80), confidence: 0.55 },
      { key: 'base_rent', value: '$12,000/month', confidence: 0.72 },
      { key: 'security_deposit', value: '$24,000', confidence: 0.88 },
    ]),
    confidence_score: 0.7625,
    review_status: 'pending', // Flagged for review — low confidence on expiration_date
  });

  // Abstraction 4: Sunrise Cafe — approved, long-term lease (no expiration within 90 days)
  await knex('lease_abstractions').insert({
    document_id: DOC_5_ID,
    tenant_id: TENANT_4_ID,
    commencement_date: daysFromNow(-365 * 2),
    expiration_date: daysFromNow(365 * 2),
    base_rent_cents: 800000, // $8,000/month
    rent_escalation: JSON.stringify({ type: 'fixed_increase', amount_cents: 50000 }),
    cam_cap_cents: 400000,
    security_deposit_cents: 1600000,
    renewal_options: JSON.stringify([
      { term_months: 60, notice_days: 90, rent_increase_percent: 3.0 },
    ]),
    extracted_terms: JSON.stringify([
      { key: 'commencement_date', value: daysFromNow(-365 * 2), confidence: 0.97 },
      { key: 'expiration_date', value: daysFromNow(365 * 2), confidence: 0.96 },
      { key: 'base_rent', value: '$8,000/month', confidence: 0.94 },
      { key: 'cam_cap', value: '$4,000/month', confidence: 0.91 },
      { key: 'security_deposit', value: '$16,000', confidence: 0.98 },
    ]),
    confidence_score: 0.952,
    review_status: 'approved',
  });

  // ─── CAM Reconciliations ──────────────────────────────────────────────────────

  // Completed reconciliation (historical)
  const reconciliationCompletedId = '77777777-7777-7777-7777-777777777777';
  await knex('cam_reconciliations').insert({
    id: reconciliationCompletedId,
    property_id: PROPERTY_1_ID,
    period_start: daysFromNow(-180),
    period_end: daysFromNow(-90),
    total_expenses_cents: 7500000, // $75,000
    status: 'completed',
    created_by: USER_ID,
    completed_at: timestampDaysAgo(85),
  });

  // In-progress reconciliation (shows in pending reconciliations widget)
  const reconciliationInProgressId = '77777777-7777-7777-7777-777777777778';
  await knex('cam_reconciliations').insert({
    id: reconciliationInProgressId,
    property_id: PROPERTY_2_ID,
    period_start: daysFromNow(-90),
    period_end: daysFromNow(-1),
    total_expenses_cents: 4200000, // $42,000
    status: 'in_progress',
    created_by: USER_ACCOUNTANT_ID,
    completed_at: null,
  });

  // Draft reconciliation (also shows in pending widget)
  const reconciliationDraftId = '77777777-7777-7777-7777-777777777779';
  await knex('cam_reconciliations').insert({
    id: reconciliationDraftId,
    property_id: PROPERTY_1_ID,
    period_start: daysFromNow(-90),
    period_end: daysFromNow(-1),
    total_expenses_cents: 0,
    status: 'draft',
    created_by: USER_ID,
    completed_at: null,
  });

  // ─── CAM Line Items (for the completed reconciliation) ────────────────────────

  await knex('cam_line_items').insert([
    {
      reconciliation_id: reconciliationCompletedId,
      category: 'Maintenance',
      description: 'Building maintenance and repairs',
      amount_cents: 3000000,
    },
    {
      reconciliation_id: reconciliationCompletedId,
      category: 'Utilities',
      description: 'Common area electricity and water',
      amount_cents: 2000000,
    },
    {
      reconciliation_id: reconciliationCompletedId,
      category: 'Insurance',
      description: 'Property insurance premium',
      amount_cents: 1500000,
    },
    {
      reconciliation_id: reconciliationCompletedId,
      category: 'Landscaping',
      description: 'Grounds maintenance and snow removal',
      amount_cents: 1000000,
    },
  ]);

  // CAM Line Items for the in-progress reconciliation
  await knex('cam_line_items').insert([
    {
      reconciliation_id: reconciliationInProgressId,
      category: 'Maintenance',
      description: 'Retail center maintenance',
      amount_cents: 1500000,
    },
    {
      reconciliation_id: reconciliationInProgressId,
      category: 'Utilities',
      description: 'Common area utilities',
      amount_cents: 1200000,
    },
    {
      reconciliation_id: reconciliationInProgressId,
      category: 'Security',
      description: 'Security services and monitoring',
      amount_cents: 800000,
    },
    {
      reconciliation_id: reconciliationInProgressId,
      category: 'Janitorial',
      description: 'Common area cleaning services',
      amount_cents: 700000,
    },
  ]);

  // ─── Tenant Allocations (for the completed reconciliation) ────────────────────

  await knex('tenant_allocations').insert([
    {
      reconciliation_id: reconciliationCompletedId,
      tenant_id: TENANT_1_ID,
      square_footage: 15000,
      share_percentage: 45.45,
      estimated_amount_cents: 3200000,
      actual_amount_cents: 3409091,
      variance_cents: 209091,
    },
    {
      reconciliation_id: reconciliationCompletedId,
      tenant_id: TENANT_2_ID,
      square_footage: 10000,
      share_percentage: 30.30,
      estimated_amount_cents: 2100000,
      actual_amount_cents: 2272727,
      variance_cents: 172727,
    },
    {
      reconciliation_id: reconciliationCompletedId,
      tenant_id: TENANT_3_ID,
      square_footage: 8000,
      share_percentage: 24.24,
      estimated_amount_cents: 1700000,
      actual_amount_cents: 1818182,
      variance_cents: 118182,
    },
  ]);

  // ─── Audit Trail ──────────────────────────────────────────────────────────────

  await knex('audit_trail').insert([
    {
      user_id: USER_ID,
      action: 'document.upload',
      entity_type: 'document',
      entity_id: DOC_1_ID,
      metadata: JSON.stringify({ filename: 'techcorp-lease-2024.pdf', size: 2048576 }),
    },
    {
      user_id: USER_ID,
      action: 'document.upload',
      entity_type: 'document',
      entity_id: DOC_2_ID,
      metadata: JSON.stringify({ filename: 'legal-assoc-lease-2024.pdf', size: 1536000 }),
    },
    {
      user_id: USER_MANAGER_ID,
      action: 'document.upload',
      entity_type: 'document',
      entity_id: DOC_4_ID,
      metadata: JSON.stringify({ filename: 'creative-design-lease.pdf', size: 1820000 }),
    },
    {
      user_id: USER_MANAGER_ID,
      action: 'document.upload',
      entity_type: 'document',
      entity_id: DOC_5_ID,
      metadata: JSON.stringify({ filename: 'sunrise-cafe-lease.pdf', size: 1450000 }),
    },
    {
      user_id: USER_ID,
      action: 'reconciliation.complete',
      entity_type: 'cam_reconciliation',
      entity_id: reconciliationCompletedId,
      metadata: JSON.stringify({ property: 'Riverside Office Park', period: 'Last Quarter' }),
    },
    {
      user_id: USER_ACCOUNTANT_ID,
      action: 'reconciliation.start',
      entity_type: 'cam_reconciliation',
      entity_id: reconciliationInProgressId,
      metadata: JSON.stringify({ property: 'Downtown Retail Center', period: 'Current Quarter' }),
    },
  ]);

  // ─── Activity Feed ────────────────────────────────────────────────────────────

  await knex('activity_feed').insert([
    {
      user_id: USER_ID,
      organization_id: ORG_ID,
      property_id: PROPERTY_1_ID,
      tenant_id: TENANT_1_ID,
      action: 'lease.uploaded',
      description: 'Uploaded TechCorp lease agreement for 2024',
    },
    {
      user_id: USER_MANAGER_ID,
      organization_id: ORG_ID,
      property_id: PROPERTY_1_ID,
      tenant_id: TENANT_3_ID,
      action: 'lease.uploaded',
      description: 'Uploaded Creative Design Studio lease agreement',
    },
    {
      user_id: USER_ID,
      organization_id: ORG_ID,
      property_id: PROPERTY_1_ID,
      tenant_id: null,
      action: 'reconciliation.completed',
      description: 'Completed CAM reconciliation for Riverside Office Park',
    },
    {
      user_id: USER_ACCOUNTANT_ID,
      organization_id: ORG_ID,
      property_id: PROPERTY_2_ID,
      tenant_id: null,
      action: 'reconciliation.started',
      description: 'Started CAM reconciliation for Downtown Retail Center',
    },
    {
      user_id: USER_MANAGER_ID,
      organization_id: ORG_ID,
      property_id: PROPERTY_2_ID,
      tenant_id: TENANT_4_ID,
      action: 'lease.uploaded',
      description: 'Uploaded Sunrise Cafe lease agreement',
    },
    {
      user_id: USER_ID,
      organization_id: ORG_ID,
      property_id: PROPERTY_1_ID,
      tenant_id: TENANT_1_ID,
      action: 'abstraction.approved',
      description: 'Approved lease abstraction for TechCorp Solutions',
    },
  ]);

  // ─── Notifications ────────────────────────────────────────────────────────────

  await knex('notifications').insert([
    {
      user_id: USER_ID,
      type: 'lease_expiration',
      title: 'Lease Expiring in 25 Days',
      message: `TechCorp Solutions lease expires on ${daysFromNow(25)}. Consider initiating renewal discussions.`,
      is_read: false,
      link: `/properties/${PROPERTY_1_ID}`,
    },
    {
      user_id: USER_ID,
      type: 'lease_expiration',
      title: 'Lease Expiring in 55 Days',
      message: `Legal Associates LLP lease expires on ${daysFromNow(55)}. Review renewal options.`,
      is_read: false,
      link: `/properties/${PROPERTY_1_ID}`,
    },
    {
      user_id: USER_MANAGER_ID,
      type: 'abstraction_review',
      title: 'Abstraction Needs Review',
      message: 'Creative Design Studio lease abstraction has low confidence and requires human review.',
      is_read: false,
      link: `/abstractions`,
    },
    {
      user_id: USER_ID,
      type: 'reconciliation_reminder',
      title: 'CAM Reconciliation In Progress',
      message: 'Downtown Retail Center reconciliation is in progress. Review and finalize.',
      is_read: false,
      link: `/reconciliations`,
    },
    {
      user_id: USER_ACCOUNTANT_ID,
      type: 'reconciliation_reminder',
      title: 'CAM Reconciliation Due',
      message: 'Riverside Office Park Q1 reconciliation draft needs expense data.',
      is_read: true,
      link: `/reconciliations`,
    },
  ]);
}

# Implementation Plan: Property Document Platform

## Overview

Build a demo-ready full-stack property document management platform with React/TypeScript frontend and Node.js/Express/TypeScript backend. The implementation is ordered for incremental delivery — each phase produces working functionality that builds toward a complete demo covering document upload, CAM reconciliation, lease abstraction, search, reports, and a dashboard.

## Tasks

- [x] 1. Project scaffolding and shared infrastructure
  - [x] 1.1 Initialize monorepo with backend and frontend packages
    - Create top-level package.json with workspaces for `backend/` and `frontend/`
    - Initialize backend with Express, TypeScript, ts-node-dev, and eslint
    - Initialize frontend with Vite + React + TypeScript
    - Add shared tsconfig base and path aliases
    - _Requirements: 16.1, 17.1_

  - [x] 1.2 Set up PostgreSQL database schema and migrations
    - Install Knex.js (or Prisma) for migrations and query building
    - Create initial migration with tables: organizations, users, properties, tenants, documents, document_versions, lease_abstractions, cam_reconciliations, cam_line_items, tenant_allocations, audit_trail, activity_feed
    - Add indexes on propertyId, tenantId, documentType, createdAt
    - Seed script with demo data (2 properties, 5 tenants, sample documents)
    - _Requirements: 17.4, 18.1_

  - [x] 1.3 Set up backend core middleware and utilities
    - Configure Express with JSON body parsing, CORS, and request ID middleware
    - Add structured logging (pino or winston) with request ID, user ID, duration
    - Add global error handler with consistent error response format
    - Add input validation middleware using zod
    - _Requirements: 17.1, 17.2, 17.5_

  - [x] 1.4 Set up authentication and RBAC
    - Implement JWT-based auth with access token and refresh token endpoints
    - Create auth middleware that validates tokens and attaches user context
    - Implement role-based authorization middleware (Admin, Property Manager, Accountant, Read-Only)
    - Add property-level scoping to authorization checks
    - Seed demo users with different roles
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 2. Document management backend
  - [x] 2.1 Implement document upload and storage service
    - Create document upload endpoint with multer for multipart handling
    - Store files to local filesystem (S3-compatible in production, local for demo)
    - Compute SHA-256 checksum on upload
    - Create metadata record in PostgreSQL with version=1
    - Enforce 100MB file size limit with descriptive error
    - _Requirements: 1.1, 1.2, 1.5, 1.6_

  - [x] 2.2 Implement document versioning and retrieval
    - Create endpoint to upload new version of existing document
    - Implement optimistic locking for concurrent version conflicts
    - Create endpoint to list all versions of a document
    - Create endpoint to retrieve/download a specific version
    - Ensure version numbers are strictly monotonically increasing
    - _Requirements: 1.3, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.3 Implement audit trail
    - Create audit trail service that logs all document operations (create, view, download, update, delete, share, sign)
    - Record user, timestamp, action, and metadata for each entry
    - Create endpoint to retrieve audit trail for a document
    - _Requirements: 2.1, 2.2_

  - [ ]* 2.4 Write property tests for document versioning
    - **Property 2: Document versions are monotonically increasing**
    - **Property 3: Adding a version never removes existing versions**
    - **Validates: Requirements 2.5, 1.3**

- [x] 3. CAM reconciliation engine
  - [x] 3.1 Implement CAM allocation calculation service
    - Create CAM engine module with pro-rata share calculation (square footage based)
    - Implement expense aggregation from line items
    - Apply CAM caps from lease terms
    - Calculate variance (actual allocated minus estimated) per tenant
    - Use integer cents for monetary calculations to avoid floating point issues
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.8_

  - [x] 3.2 Implement reconciliation API endpoints
    - Create endpoint to initiate reconciliation for a property and period
    - Validate that tenant square footages don't exceed total leasable area
    - Validate that all tenants have required lease terms
    - Reject reconciliation with validation errors if data is inconsistent
    - Store reconciliation results (allocations, variances, status)
    - Verify allocation percentages sum to 1.0 within tolerance of 0.0001
    - _Requirements: 3.5, 3.6, 3.7_

  - [ ]* 3.3 Write property tests for CAM engine
    - **Property 1: CAM allocation percentages sum to 1.0 (within floating point tolerance)**
    - **Property 6: Pro-rata share is always in valid range [0.0, 1.0]**
    - **Property 7: Variance calculation is consistent (actual minus estimated)**
    - **Validates: Requirements 3.1, 3.4, 3.7**

- [x] 4. Checkpoint - Backend core services
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. AI lease abstraction service
  - [x] 5.1 Implement lease abstraction processing
    - Create abstraction service that accepts a document ID and extracts terms
    - Implement mock AI extraction (structured parsing for demo; real AI integration later)
    - Extract key fields: commencement date, expiration date, base rent, tenant name, premises description
    - Assign confidence scores to each extracted term
    - Calculate overall confidence as arithmetic mean of term scores
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 5.2 Implement review workflow for abstractions
    - Flag results for human review when any term confidence < 0.60
    - Flag results when fewer than 5 terms extracted
    - Flag results when required lease fields are missing
    - Create endpoint to approve/correct abstraction results
    - Store approved structured terms in database
    - _Requirements: 4.3, 4.4, 4.5, 4.8_

  - [ ]* 5.3 Write property tests for lease abstraction
    - **Property 4: Low confidence terms always trigger review**
    - **Property 5: Empty terms always require review with confidence 0.0**
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [x] 6. Search service
  - [x] 6.1 Implement search API with PostgreSQL full-text search
    - Create search endpoint with text query parameter
    - Implement full-text search using PostgreSQL tsvector/tsquery (Elasticsearch for production, PG for demo)
    - Return results with document title, snippet, type, property name, last modified
    - Implement faceted filtering by property, tenant, document type, date range
    - Enforce pagination with max page size of 100
    - Reject empty search queries with validation error
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_

  - [ ]* 6.2 Write property tests for search validation
    - **Property 8: Search validation rejects invalid queries (empty text)**
    - **Validates: Requirements 7.4, 7.5**

- [x] 7. Report generation service
  - [x] 7.1 Implement report generation endpoints
    - Create tenant statement endpoint that generates charge breakdown for a tenant/period
    - Create variance report endpoint comparing estimated vs actual allocations
    - Create reconciliation package endpoint producing complete audit document
    - Support PDF output using pdfkit or puppeteer
    - Support Excel output using exceljs
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Dashboard and analytics API
  - [x] 8.1 Implement dashboard data endpoints
    - Create endpoint returning upcoming lease expirations (30/60/90 day buckets)
    - Create endpoint returning pending CAM reconciliations with status
    - Create endpoint returning overdue documents requiring action
    - Create endpoint returning portfolio metrics (total properties, tenants, occupancy rate, total area)
    - Scope all data to authenticated user's permitted properties
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

- [x] 9. Activity feed and notifications API
  - [x] 9.1 Implement activity feed service
    - Record actions on properties/tenants (document uploads, version changes, reconciliation events, workflow changes)
    - Create endpoint to retrieve activity timeline for a property (reverse chronological)
    - Create endpoint to retrieve activity timeline for a tenant
    - Scope visibility to users with property access
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 9.2 Implement in-app notifications
    - Create notifications table and service
    - Generate notifications for lease expirations (30/60/90 day alerts)
    - Generate notifications for overdue document reviews
    - Create endpoint to list and mark notifications as read
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.7_

- [x] 10. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend foundation and layout
  - [x] 11.1 Set up frontend routing and layout shell
    - Configure React Router with client-side routing
    - Create app shell with sidebar navigation, top bar with user menu
    - Create layout components: MainLayout, AuthLayout
    - Set up a component library (use shadcn/ui or MUI for rapid demo development)
    - Add loading indicators and skeleton screen components
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 11.2 Implement authentication UI
    - Create login page with email/password form
    - Implement token storage and refresh logic
    - Add protected route wrapper that redirects unauthenticated users
    - Display current user and role in top bar
    - _Requirements: 14.5, 14.6, 16.2_

  - [x] 11.3 Set up API client and state management
    - Create typed API client with axios or fetch wrapper
    - Add request/response interceptors for auth tokens and error handling
    - Set up React Query (TanStack Query) for server state management
    - Implement optimistic updates pattern for common operations
    - Add global error toast/notification component
    - _Requirements: 16.5, 16.6_

- [x] 12. Dashboard and property views
  - [x] 12.1 Build dashboard page
    - Create dashboard page with metric cards (total properties, tenants, occupancy, area)
    - Add lease expiration widget showing 30/60/90 day buckets with counts
    - Add pending reconciliations widget with status indicators
    - Add overdue documents widget with action links
    - Add recent activity feed widget
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 12.2 Build property list and detail pages
    - Create property list page with data table (sortable, filterable)
    - Create property detail page with tabs: Overview, Documents, Tenants, Activity
    - Display property metrics and tenant summary on overview tab
    - Show activity timeline on activity tab
    - _Requirements: 15.2, 16.3_

  - [x] 12.3 Build tenant list and detail pages
    - Create tenant list page (filterable by property)
    - Create tenant detail page with lease info, documents, and activity timeline
    - Display current lease terms and abstraction status
    - _Requirements: 15.3, 16.3_

- [x] 13. Document management UI
  - [x] 13.1 Build document upload and list views
    - Create document list view with data table (type, property, tenant, date, version)
    - Implement drag-and-drop file upload component
    - Show upload progress indicator
    - Display per-document version history in expandable row or side panel
    - _Requirements: 1.1, 1.3, 16.4, 11.5_

  - [x] 13.2 Build document detail and version history view
    - Create document detail page showing metadata, current version, and audit trail
    - Add version history timeline with download links for each version
    - Add "Upload New Version" action
    - Show AI abstraction status and extracted terms if available
    - _Requirements: 2.1, 2.4, 4.8_

- [x] 14. CAM reconciliation UI
  - [x] 14.1 Build reconciliation workflow pages
    - Create "New Reconciliation" form (select property, period, confirm tenants)
    - Build reconciliation results view showing per-tenant allocations table
    - Display variance column with color coding (positive/negative)
    - Add "Generate Report" button that triggers PDF/Excel download
    - Show reconciliation history list for a property
    - _Requirements: 3.1, 3.4, 5.1, 5.2_

- [x] 15. Lease abstraction UI
  - [x] 15.1 Build abstraction review interface
    - Create abstraction queue page showing documents pending review
    - Build review form displaying extracted terms with confidence indicators
    - Allow inline editing of extracted values
    - Add approve/reject actions that update backend
    - Color-code confidence scores (green ≥0.85, yellow ≥0.60, red <0.60)
    - _Requirements: 4.3, 4.8, 16.3_

- [x] 16. Search UI
  - [x] 16.1 Build global search interface
    - Add search bar in top navigation with keyboard shortcut
    - Create search results page with relevance-ranked results
    - Show document title, snippet, type, property, and last modified
    - Add facet filters sidebar (property, tenant, document type, date range)
    - Implement pagination with "load more" or page numbers
    - _Requirements: 7.1, 7.2, 7.5, 7.6_

- [ ] 17. Notifications UI
  - [x] 17.1 Build notification center
    - Add notification bell icon in top bar with unread count badge
    - Create notification dropdown/panel showing recent notifications
    - Mark notifications as read on click
    - Link notifications to relevant pages (property, document, reconciliation)
    - _Requirements: 9.7, 16.3_

- [x] 18. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Integration and demo polish
  - [x] 19.1 End-to-end wiring and demo data
    - Verify all frontend pages connect to backend APIs correctly
    - Ensure demo seed data produces meaningful dashboard metrics
    - Add sample lease PDFs that trigger abstraction flow
    - Add sample expense data for CAM reconciliation demo
    - Verify complete user flows: upload → abstract → reconcile → report → search
    - _Requirements: 1.7, 7.3, 8.5_

  - [ ]* 19.2 Write integration tests for critical flows
    - Test document upload → version → retrieval flow
    - Test CAM reconciliation end-to-end with demo data
    - Test search returns recently uploaded documents
    - Test auth flow (login, token refresh, role enforcement)
    - _Requirements: 17.1, 18.2_

- [x] 20. Final checkpoint - Demo ready
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Real AI-Powered Lease Abstraction (LLM Integration)
  - [x] 21.1 Implement LLM extraction service with source highlighting
    - Create backend/src/abstraction/llm-extractor.ts with OpenAI/Anthropic API integration
    - Accept PDF text content and return structured extracted terms with page/paragraph source references
    - Support configurable provider (OPENAI_API_KEY or ANTHROPIC_API_KEY env vars)
    - Include source highlighting metadata: page number, character offsets, original text snippet
    - Implement retry logic with exponential backoff for API failures
    - Add token usage tracking for cost monitoring
    - Fall back to mock extractor when no API key is configured
    - _Requirements: 4.1, 4.2_

  - [x] 21.2 Implement PDF text extraction pipeline
    - Add pdf-parse dependency for extracting text from uploaded PDFs
    - Create backend/src/abstraction/pdf-parser.ts that extracts text with page boundaries
    - Handle multi-page documents preserving page number metadata
    - Extract text layout information for source highlighting
    - _Requirements: 4.1_

  - [x] 21.3 Update abstraction service to use real LLM
    - Replace mock extractor call with LLM extractor when API key is available
    - Structure the LLM prompt to extract: commencement_date, expiration_date, base_rent, rent_escalation, cam_cap, security_deposit, tenant_name, premises_description, renewal_options, permitted_use, insurance_requirements
    - Parse LLM response into ExtractedTerm[] with confidence scores derived from LLM certainty
    - Store source references (page, offset, snippet) alongside each extracted term
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 21.4 Add source highlighting to abstraction UI
    - Update frontend abstraction review page to show source text snippets for each extracted term
    - Highlight the relevant source passage with page number reference
    - Allow user to click a term and see the original text that was used for extraction
    - _Requirements: 4.8_

- [x] 22. Integrations Layer (DocuSign + QuickBooks)
  - [x] 22.1 Create integrations framework and configuration
    - Create backend/src/integrations/ directory with base integration architecture
    - Add integrations table migration: id, organization_id, provider (docusign/quickbooks), status (connected/disconnected), credentials (encrypted jsonb), config, created_at, updated_at
    - Create integration.service.ts with connect/disconnect/getStatus/refreshToken patterns
    - Create integration.routes.ts: GET /api/integrations, POST /api/integrations/:provider/connect, DELETE /api/integrations/:provider/disconnect
    - Add DOCUSIGN_CLIENT_ID, DOCUSIGN_CLIENT_SECRET, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET to .env.example
    - _Requirements: 6.1, 6.5_

  - [x] 22.2 Implement DocuSign integration
    - Create backend/src/integrations/docusign/docusign.service.ts
    - Implement OAuth 2.0 authorization code flow for DocuSign
    - Create envelope sending: POST /api/integrations/docusign/send (body: { documentId, signers: [{name, email}] })
    - Implement webhook handler for signature completion events: POST /api/integrations/docusign/webhook
    - On signature completion: store signed document as new version, update workflow status
    - Create GET /api/integrations/docusign/status/:envelopeId for checking signature status
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 22.3 Implement QuickBooks integration
    - Create backend/src/integrations/quickbooks/quickbooks.service.ts
    - Implement OAuth 2.0 authorization code flow for QuickBooks Online
    - Sync tenant charges: POST /api/integrations/quickbooks/sync-charges (pushes CAM allocations as invoices)
    - Import expenses: POST /api/integrations/quickbooks/import-expenses (pulls expense data for CAM reconciliation)
    - Map QuickBooks chart of accounts to CAM expense categories
    - Create GET /api/integrations/quickbooks/accounts for listing available QB accounts
    - _Requirements: 3.2, 5.1_

  - [x] 22.4 Build integrations settings UI
    - Create frontend/src/pages/IntegrationsPage.tsx
    - Show available integrations (DocuSign, QuickBooks) with connect/disconnect buttons
    - Display connection status and last sync time
    - Add OAuth redirect handling for both providers
    - Add "Send for Signature" button on document detail page (when DocuSign connected)
    - Add "Sync to QuickBooks" button on reconciliation detail page (when QB connected)
    - Add route /integrations to App.tsx and sidebar navigation
    - _Requirements: 6.1, 16.3_

- [x] 23. Tenant & Owner Portal
  - [x] 23.1 Create public portal routes with token-based access (no full login for tenants)
    - Create backend/src/portal/ directory with portal auth middleware (magic link / token-based)
    - Generate unique portal access tokens per tenant (stored in DB with expiry)
    - Create portal routes: GET /api/portal/verify/:token, GET /api/portal/dashboard
    - Tokens are emailed to tenants or shared via link — no username/password needed
    - Add portal_tokens table migration (id, tenant_id, token_hash, expires_at, created_at)
    - _Requirements: 10.1, 10.4_

  - [x] 23.2 Build tenant dashboard (documents, statements, outstanding balances)
    - Create frontend/src/pages/portal/TenantPortalPage.tsx
    - Show tenant's shared documents (read-only)
    - Display current and historical statements with charge breakdowns
    - Show outstanding balance (sum of unpaid variances from reconciliations)
    - Add download links for statements (PDF)
    - Portal routes: GET /api/portal/documents, GET /api/portal/statements, GET /api/portal/balance
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 23.3 Build owner/investor view with branded PDF reports
    - Create owner portal with property-level financial summaries
    - Generate branded PDF reports with organization logo and colors
    - Include: occupancy rates, revenue summary, CAM recovery rates, lease expiration timeline
    - Portal routes: GET /api/portal/owner/properties, GET /api/portal/owner/reports/:propertyId
    - Add branding config to organizations table (logo_url, primary_color, report_header)
    - _Requirements: 5.5, 8.4_

  - [x] 23.4 Add payment integration (Stripe for CAM true-ups)
    - Create backend/src/payments/ directory with Stripe integration
    - Generate payment links for tenant CAM true-up amounts (positive variances)
    - Handle Stripe webhooks for payment confirmation
    - Update tenant balance on successful payment
    - Portal route: POST /api/portal/payments/create-session (creates Stripe Checkout session)
    - Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET to .env.example
    - _Requirements: 10.5_

- [x] 24. Usage Metering & Billing
  - [x] 24.1 Implement usage tracking service (AI calls, CAM runs, storage GB, users)
    - Create backend/src/billing/usage.service.ts
    - Track events: ai_abstraction_call, cam_reconciliation_run, document_upload (with size), active_users
    - Store in usage_events table (id, organization_id, event_type, quantity, metadata, created_at)
    - Create aggregation queries: monthly totals by event type per organization
    - Add migration for usage_events table
    - _Requirements: 17.3_

  - [x] 24.2 Create subscription & plan management (Starter / Pro / Enterprise)
    - Create backend/src/billing/plans.service.ts with plan definitions
    - Plans: Starter (5 properties, 50 docs, 10 AI calls/mo), Pro (25 properties, unlimited docs, 100 AI calls/mo), Enterprise (unlimited)
    - Add subscriptions table (id, organization_id, plan_id, status, current_period_start, current_period_end, stripe_subscription_id)
    - Enforce plan limits in middleware (check before AI calls, document uploads, property creation)
    - Create GET /api/billing/plan, GET /api/billing/usage endpoints
    - _Requirements: 17.3_

  - [x] 24.3 Add Stripe integration for recurring + usage billing
    - Create backend/src/billing/stripe.service.ts
    - Implement Stripe Checkout for plan upgrades
    - Implement Stripe metered billing for AI usage overages
    - Handle subscription webhooks (payment_succeeded, subscription_updated, subscription_cancelled)
    - Routes: POST /api/billing/create-checkout, POST /api/billing/webhook, GET /api/billing/invoices
    - _Requirements: 17.3_

  - [x] 24.4 Build admin billing dashboard
    - Create frontend/src/pages/BillingPage.tsx
    - Show current plan, usage meters (AI calls used/limit, storage used/limit, properties used/limit)
    - Display billing history with invoice links
    - Add upgrade/downgrade buttons that trigger Stripe Checkout
    - Add route /billing to App.tsx and sidebar (admin-only)
    - _Requirements: 16.3_

- [x] 25. Advanced CAM & What-If Simulator
  - [x] 25.1 Extend CAM engine with multiple allocation methods + what-if mode
    - Add allocation methods: pro-rata (existing), fixed percentage, base year stop, modified gross, custom formula
    - Add gross-up calculation (adjust expenses to 95% occupancy baseline)
    - Add exclusion categories (capital improvements, management fees configurable per lease)
    - Create what-if mode: accepts hypothetical inputs (new tenant sqft, different expenses) without persisting
    - Route: POST /api/reconciliations/what-if (same input as reconcile but returns result without saving)
    - _Requirements: 3.8_

  - [x] 25.2 Add variance explanation using LLM
    - After reconciliation completes, call LLM to generate plain-English variance explanations
    - For each tenant with significant variance (>10%), explain why their charges changed
    - Store explanations alongside reconciliation results
    - Include in variance reports and tenant statements
    - Route: POST /api/reconciliations/:id/explain
    - _Requirements: 3.4, 5.2_

  - [x] 25.3 Build interactive what-if UI (live preview of tenant impact)
    - Create frontend/src/pages/WhatIfSimulatorPage.tsx
    - Allow user to adjust: expense amounts, add/remove tenants, change allocation method, modify occupancy
    - Show real-time recalculation of allocations as inputs change (debounced API calls or client-side calc)
    - Display side-by-side comparison: current vs simulated allocations
    - Add route /reconciliations/simulator to App.tsx
    - _Requirements: 3.8, 16.3_

- [x] 26. Onboarding & Data Import
  - [x] 26.1 Excel/CSV bulk importer for rent rolls and expenses
    - Create backend/src/import/ directory with import service
    - Accept CSV/Excel uploads with column mapping UI
    - Support import types: properties, tenants, lease terms, historical expenses
    - Validate each row against schema, return detailed error report for invalid rows
    - Create records in bulk within a transaction (rollback on critical errors)
    - Routes: POST /api/import/upload, POST /api/import/validate, POST /api/import/execute
    - Add exceljs for reading Excel files (already installed for reports)
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [x] 26.2 Yardi/MRI export parser
    - Create backend/src/import/parsers/yardi.parser.ts and mri.parser.ts
    - Parse standard Yardi export formats (rent roll CSV, charge code mapping)
    - Parse MRI export formats (tenant list, lease abstract export)
    - Map external field names to platform schema
    - Route: POST /api/import/parse-yardi, POST /api/import/parse-mri
    - _Requirements: 13.5_

  - [x] 26.3 Onboarding wizard with guided setup
    - Create frontend/src/pages/OnboardingPage.tsx with multi-step wizard
    - Steps: 1) Organization setup, 2) Import properties, 3) Import tenants, 4) Upload leases, 5) Review & confirm
    - Each step validates before proceeding
    - Show progress indicator and allow going back to previous steps
    - On completion, redirect to dashboard with populated data
    - Add route /onboarding to App.tsx (shown on first login when no properties exist)
    - _Requirements: 13.1, 16.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- For the demo, local filesystem replaces S3 and PostgreSQL full-text search replaces Elasticsearch
- The AI abstraction uses mock/structured parsing for demo; swap in OpenAI API for production
- shadcn/ui or MUI recommended for rapid UI development without custom component design
- Tasks 21-22 add production-grade AI and integrations on top of the demo foundation
- Tasks 23-26 add commercial-grade features for market readiness

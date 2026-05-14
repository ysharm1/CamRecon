# Property Document Platform

A full-stack property document management platform for mid-market property management firms. Replaces manual, spreadsheet-driven workflows with automated CAM reconciliation, AI-powered lease abstraction, professional report generation, and comprehensive document management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, TanStack Query, React Router |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL with Knex.js migrations |
| Auth | JWT (access + refresh tokens), bcrypt |
| Reports | PDFKit (PDF), ExcelJS (Excel) |
| Search | PostgreSQL full-text search (tsvector/tsquery) |

## Prerequisites

- **Node.js** 18+ (with npm)
- **PostgreSQL** 14+ running locally or accessible via connection string

## Getting Started

### 1. Clone and install dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Set up the database

Create a PostgreSQL database:

```bash
createdb property_platform_dev
```

Copy the environment file and configure your database connection:

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

### 3. Run migrations and seed demo data

```bash
cd backend
npx knex migrate:latest
npx knex seed:run
```

### 4. Start development servers

In two terminals:

```bash
# Terminal 1 — Backend (port 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

The frontend Vite dev server proxies all `/api/*` requests to the backend on port 3001.

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@acme-pm.com | admin123 |
| Property Manager | manager@acme-pm.com | manager123 |
| Accountant | accountant@acme-pm.com | account123 |
| Read-Only | viewer@acme-pm.com | viewer123 |

## Demo Data

The seed script creates:
- **1 organization** — Acme Property Management
- **2 properties** — Riverside Office Park (commercial), Downtown Retail Center (retail)
- **5 tenants** across both properties
- **5 documents** with sample lease PDFs in `backend/uploads/sample/`
- **4 lease abstractions** — including one pending review (low confidence)
- **3 CAM reconciliations** — completed, in-progress, and draft
- **Notifications, activity feed, and audit trail entries**

All dates are dynamic (relative to the current date) so the dashboard always shows meaningful data:
- Lease expirations within 30, 60, and 90 days
- Pending reconciliations in the dashboard widget
- Overdue abstractions requiring review

## Available API Endpoints

### Authentication
- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/logout` — Logout

### Documents
- `GET /api/documents` — List documents (filterable by propertyId)
- `POST /api/documents` — Upload a document (multipart/form-data)
- `GET /api/documents/:id` — Get document details
- `GET /api/documents/:id/versions` — List document versions
- `POST /api/documents/:id/versions` — Upload new version

### Lease Abstractions
- `GET /api/abstractions/pending` — List pending abstractions
- `GET /api/abstractions/:id` — Get abstraction details
- `PUT /api/abstractions/:id/approve` — Approve abstraction
- `PUT /api/abstractions/:id/reject` — Reject abstraction
- `PUT /api/abstractions/:id/correct` — Correct abstraction terms

### CAM Reconciliations
- `GET /api/reconciliations` — List reconciliations
- `POST /api/reconciliations` — Create new reconciliation
- `GET /api/reconciliations/:id` — Get reconciliation details

### Dashboard
- `GET /api/dashboard` — Get all dashboard data (metrics, expirations, pending items)

### Search
- `GET /api/search?q=<query>` — Full-text search across documents

### Reports
- `GET /api/reports/tenant-statement/:tenantId` — Generate tenant statement
- `GET /api/reports/variance/:reconciliationId` — Generate variance report
- `GET /api/reports/reconciliation-package/:reconciliationId` — Generate reconciliation package

### Properties & Tenants
- `GET /api/properties` — List properties
- `GET /api/properties/:id` — Get property details
- `GET /api/tenants` — List tenants
- `GET /api/tenants/:id` — Get tenant details

### Activity & Notifications
- `GET /api/activity` — Get activity feed
- `GET /api/notifications` — Get notifications
- `PUT /api/notifications/:id/read` — Mark notification as read

### Audit Trail
- `GET /api/audit/document/:documentId` — Get audit trail for a document

### Integrations
- `GET /api/integrations` — List available integrations
- `POST /api/integrations/docusign/connect` — Connect DocuSign
- `POST /api/integrations/quickbooks/connect` — Connect QuickBooks

### Health
- `GET /api/health` — Health check

## Project Structure

```
├── backend/
│   ├── migrations/          # Knex database migrations
│   ├── seeds/               # Demo seed data
│   ├── uploads/sample/      # Sample PDF files for demo
│   ├── src/
│   │   ├── abstraction/     # AI lease abstraction service
│   │   ├── activity/        # Activity feed service
│   │   ├── audit/           # Audit trail service
│   │   ├── auth/            # Authentication & RBAC
│   │   ├── cam/             # CAM reconciliation engine
│   │   ├── dashboard/       # Dashboard analytics
│   │   ├── documents/       # Document management
│   │   ├── integrations/    # DocuSign, QuickBooks
│   │   ├── middleware/      # Express middleware
│   │   ├── notifications/   # Notification service
│   │   ├── properties/      # Property management
│   │   ├── reports/         # PDF/Excel report generation
│   │   ├── search/          # Full-text search
│   │   └── tenants/         # Tenant management
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── hooks/           # React Query hooks (API layer)
│   │   ├── layouts/         # App layouts (Main, Auth)
│   │   ├── lib/             # API client, auth utilities
│   │   └── pages/           # Route pages
│   └── vite.config.ts       # Vite config with API proxy
└── README.md
```

## Key User Flows

1. **Upload → Abstract** — Upload a lease PDF → AI extracts terms → Review/approve abstraction
2. **Reconcile** — Select property + period → Engine calculates allocations → View variances
3. **Report** — Generate tenant statements or variance reports as PDF/Excel
4. **Search** — Full-text search across all documents, properties, and lease terms
5. **Dashboard** — At-a-glance portfolio health: expiring leases, pending reconciliations, overdue reviews

## Running Tests

```bash
cd backend
npm test
```

## License

Private — Internal use only.

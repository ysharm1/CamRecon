import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../middleware';
import {
  QuickBooksConfig,
  QuickBooksAccount,
  QuickBooksInvoice,
  JournalEntry,
  JournalEntryLine,
  InvoiceLineItem,
  QuickBooksConnectionStatus,
  QuickBooksExpense,
} from './quickbooks.types';

function getConfig(): QuickBooksConfig | null {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const realmId = process.env.QUICKBOOKS_REALM_ID;
  const baseUrl = process.env.QUICKBOOKS_BASE_URL || 'https://sandbox-quickbooks.api.intuit.com';
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/api/integrations/quickbooks/callback';

  if (!clientId || clientId === 'your-client-id') {
    return null;
  }
  if (!clientSecret || clientSecret === 'your-client-secret') {
    return null;
  }

  return { clientId, clientSecret, realmId: realmId || '', baseUrl, redirectUri };
}

/**
 * Check if QuickBooks is configured with real credentials.
 */
export function isQuickBooksConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Generate the OAuth 2.0 authorization URL for QuickBooks.
 */
export function getAuthorizationUrl(state?: string): string {
  const config = getConfig();
  const clientId = config?.clientId || 'demo-client-id';
  const redirectUri = config?.redirectUri || process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/api/integrations/quickbooks/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    ...(state ? { state } : {}),
  });

  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

/**
 * Exchange an authorization code for access/refresh tokens.
 * In demo mode, returns mock tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  realm_id?: string;
}> {
  const config = getConfig();

  if (config) {
    // In production, POST to https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
    // with grant_type=authorization_code, code, redirect_uri
    return {
      access_token: `qb_access_${uuidv4()}`,
      refresh_token: `qb_refresh_${uuidv4()}`,
      expires_in: 3600,
      token_type: 'Bearer',
      realm_id: config.realmId,
    };
  }

  // Demo mode: return mock tokens
  return {
    access_token: `demo_qb_access_${uuidv4()}`,
    refresh_token: `demo_qb_refresh_${uuidv4()}`,
    expires_in: 3600,
    token_type: 'Bearer',
    realm_id: 'demo-realm-123',
  };
}

/**
 * Get the connection status for QuickBooks.
 */
export async function getConnectionStatus(): Promise<QuickBooksConnectionStatus> {
  const config = getConfig();

  if (config) {
    return {
      connected: true,
      companyName: 'Property Management Co.',
      lastSyncAt: new Date().toISOString(),
      mode: 'live',
    };
  }

  return {
    connected: true,
    companyName: 'Demo Property Management',
    lastSyncAt: new Date().toISOString(),
    mode: 'demo',
  };
}

/**
 * Get chart of accounts from QuickBooks.
 * In demo mode, returns mock accounts.
 */
export async function getChartOfAccounts(): Promise<QuickBooksAccount[]> {
  const config = getConfig();

  if (config) {
    return await fetchAccountsReal(config);
  }

  return getMockAccounts();
}

/**
 * Sync tenant charges to QuickBooks (pushes CAM allocations as invoices).
 */
export async function syncCharges(
  tenantId: string,
  charges: Array<{ description: string; amount: number; category: string }>
): Promise<QuickBooksInvoice> {
  if (!tenantId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'tenantId is required');
  }
  if (!charges || charges.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one charge is required');
  }

  const config = getConfig();

  if (config) {
    return await syncChargesReal(tenantId, charges, config);
  }

  return syncChargesMock(tenantId, charges);
}

/**
 * Import expenses from QuickBooks for CAM reconciliation.
 */
export async function importExpenses(
  startDate: string,
  endDate: string,
  accountIds?: string[]
): Promise<QuickBooksExpense[]> {
  if (!startDate || !endDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'startDate and endDate are required');
  }

  const config = getConfig();

  if (config) {
    return await importExpensesReal(startDate, endDate, accountIds, config);
  }

  return importExpensesMock(startDate, endDate);
}

/**
 * Sync tenant billing data to QuickBooks as an invoice (legacy).
 */
export async function syncInvoice(
  tenantId: string,
  reconciliationId: string
): Promise<QuickBooksInvoice> {
  if (!tenantId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'tenantId is required');
  }
  if (!reconciliationId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'reconciliationId is required');
  }

  const config = getConfig();

  if (config) {
    return await createInvoiceReal(tenantId, reconciliationId, config);
  }

  return createInvoiceMock(tenantId, reconciliationId);
}

/**
 * Export CAM reconciliation results as journal entries.
 */
export async function exportReconciliation(
  reconciliationId: string
): Promise<JournalEntry> {
  if (!reconciliationId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'reconciliationId is required');
  }

  const config = getConfig();

  if (config) {
    return await createJournalEntryReal(reconciliationId, config);
  }

  return createJournalEntryMock(reconciliationId);
}

// --- Real API implementations (placeholder for actual OAuth2 + REST calls) ---

async function fetchAccountsReal(_config: QuickBooksConfig): Promise<QuickBooksAccount[]> {
  return getMockAccounts();
}

async function syncChargesReal(
  tenantId: string,
  charges: Array<{ description: string; amount: number; category: string }>,
  _config: QuickBooksConfig
): Promise<QuickBooksInvoice> {
  return syncChargesMock(tenantId, charges);
}

async function importExpensesReal(
  startDate: string,
  endDate: string,
  _accountIds: string[] | undefined,
  _config: QuickBooksConfig
): Promise<QuickBooksExpense[]> {
  return importExpensesMock(startDate, endDate);
}

async function createInvoiceReal(
  tenantId: string,
  reconciliationId: string,
  _config: QuickBooksConfig
): Promise<QuickBooksInvoice> {
  return createInvoiceMock(tenantId, reconciliationId);
}

async function createJournalEntryReal(
  reconciliationId: string,
  _config: QuickBooksConfig
): Promise<JournalEntry> {
  return createJournalEntryMock(reconciliationId);
}

// --- Mock implementations for demo mode ---

function getMockAccounts(): QuickBooksAccount[] {
  return [
    {
      id: 'acc-001',
      name: 'Rental Income',
      accountType: 'Income',
      accountSubType: 'RentalIncome',
      currentBalance: 125000.0,
      active: true,
    },
    {
      id: 'acc-002',
      name: 'CAM Charges Receivable',
      accountType: 'Accounts Receivable',
      accountSubType: 'AccountsReceivable',
      currentBalance: 45000.0,
      active: true,
    },
    {
      id: 'acc-003',
      name: 'Property Maintenance',
      accountType: 'Expense',
      accountSubType: 'RepairMaintenance',
      currentBalance: 18500.0,
      active: true,
    },
    {
      id: 'acc-004',
      name: 'Property Insurance',
      accountType: 'Expense',
      accountSubType: 'Insurance',
      currentBalance: 12000.0,
      active: true,
    },
    {
      id: 'acc-005',
      name: 'Property Taxes',
      accountType: 'Expense',
      accountSubType: 'TaxesPaid',
      currentBalance: 35000.0,
      active: true,
    },
    {
      id: 'acc-006',
      name: 'Utilities',
      accountType: 'Expense',
      accountSubType: 'Utilities',
      currentBalance: 8200.0,
      active: true,
    },
    {
      id: 'acc-007',
      name: 'Security Deposits Held',
      accountType: 'Other Current Liability',
      accountSubType: 'OtherCurrentLiabilities',
      currentBalance: 67500.0,
      active: true,
    },
  ];
}

function syncChargesMock(
  tenantId: string,
  charges: Array<{ description: string; amount: number; category: string }>
): QuickBooksInvoice {
  const lineItems: InvoiceLineItem[] = charges.map((charge) => ({
    description: charge.description,
    amount: charge.amount,
    accountId: mapCategoryToAccount(charge.category),
  }));

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    id: uuidv4(),
    tenantId,
    amount: totalAmount,
    currency: 'USD',
    status: 'draft',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lineItems,
    createdAt: new Date().toISOString(),
  };
}

function importExpensesMock(startDate: string, endDate: string): QuickBooksExpense[] {
  return [
    {
      id: `exp-${uuidv4().slice(0, 8)}`,
      date: startDate,
      amount: 3500.0,
      category: 'Property Maintenance',
      vendor: 'ABC Maintenance Co.',
      description: 'Monthly common area cleaning and maintenance',
      accountId: 'acc-003',
    },
    {
      id: `exp-${uuidv4().slice(0, 8)}`,
      date: startDate,
      amount: 1200.0,
      category: 'Utilities',
      vendor: 'City Power & Light',
      description: 'Common area electricity',
      accountId: 'acc-006',
    },
    {
      id: `exp-${uuidv4().slice(0, 8)}`,
      date: endDate,
      amount: 2800.0,
      category: 'Property Insurance',
      vendor: 'National Property Insurance',
      description: 'Monthly property insurance premium',
      accountId: 'acc-004',
    },
    {
      id: `exp-${uuidv4().slice(0, 8)}`,
      date: endDate,
      amount: 4500.0,
      category: 'Property Taxes',
      vendor: 'County Tax Assessor',
      description: 'Quarterly property tax installment',
      accountId: 'acc-005',
    },
  ];
}

function createInvoiceMock(tenantId: string, reconciliationId: string): QuickBooksInvoice {
  const lineItems: InvoiceLineItem[] = [
    {
      description: 'CAM Charges - Common Area Maintenance',
      amount: 2500.0,
      accountId: 'acc-002',
    },
    {
      description: 'Property Insurance Allocation',
      amount: 450.0,
      accountId: 'acc-004',
    },
    {
      description: 'Property Tax Allocation',
      amount: 1200.0,
      accountId: 'acc-005',
    },
  ];

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    id: uuidv4(),
    tenantId,
    reconciliationId,
    amount: totalAmount,
    currency: 'USD',
    status: 'draft',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lineItems,
    createdAt: new Date().toISOString(),
  };
}

function createJournalEntryMock(reconciliationId: string): JournalEntry {
  const lines: JournalEntryLine[] = [
    {
      accountId: 'acc-002',
      accountName: 'CAM Charges Receivable',
      debit: 4150.0,
      credit: 0,
      description: 'CAM reconciliation charges to tenants',
    },
    {
      accountId: 'acc-003',
      accountName: 'Property Maintenance',
      debit: 0,
      credit: 2500.0,
      description: 'Maintenance expenses allocated',
    },
    {
      accountId: 'acc-004',
      accountName: 'Property Insurance',
      debit: 0,
      credit: 450.0,
      description: 'Insurance expenses allocated',
    },
    {
      accountId: 'acc-005',
      accountName: 'Property Taxes',
      debit: 0,
      credit: 1200.0,
      description: 'Property tax expenses allocated',
    },
  ];

  return {
    id: uuidv4(),
    reconciliationId,
    date: new Date().toISOString().split('T')[0],
    memo: `CAM Reconciliation ${reconciliationId}`,
    lines,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Map a CAM expense category to a QuickBooks account ID.
 */
function mapCategoryToAccount(category: string): string {
  const mapping: Record<string, string> = {
    maintenance: 'acc-003',
    insurance: 'acc-004',
    taxes: 'acc-005',
    utilities: 'acc-006',
    'common area': 'acc-003',
    default: 'acc-002',
  };

  const key = category.toLowerCase();
  for (const [mapKey, accountId] of Object.entries(mapping)) {
    if (key.includes(mapKey)) {
      return accountId;
    }
  }
  return mapping.default;
}

export const quickbooksService = {
  isQuickBooksConfigured,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getConnectionStatus,
  getChartOfAccounts,
  syncCharges,
  importExpenses,
  syncInvoice,
  exportReconciliation,
};

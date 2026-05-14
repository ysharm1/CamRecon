/**
 * TypeScript interfaces for QuickBooks integration.
 */

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  realmId: string;
  baseUrl: string;
  redirectUri: string;
}

export interface QuickBooksAccount {
  id: string;
  name: string;
  accountType: string;
  accountSubType: string;
  currentBalance: number;
  active: boolean;
}

export interface QuickBooksInvoice {
  id: string;
  tenantId: string;
  reconciliationId?: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  lineItems: InvoiceLineItem[];
  createdAt: string;
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
  accountId?: string;
}

export interface JournalEntry {
  id: string;
  reconciliationId: string;
  date: string;
  memo: string;
  lines: JournalEntryLine[];
  createdAt: string;
}

export interface JournalEntryLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

export interface SyncInvoiceRequest {
  tenantId: string;
  reconciliationId: string;
}

export interface SyncChargesRequest {
  tenantId: string;
  charges: Array<{
    description: string;
    amount: number;
    category: string;
  }>;
}

export interface ImportExpensesRequest {
  startDate: string;
  endDate: string;
  accountIds?: string[];
}

export interface ExportReconciliationRequest {
  reconciliationId: string;
}

export interface QuickBooksConnectionStatus {
  connected: boolean;
  companyName?: string;
  lastSyncAt?: string;
  mode: 'live' | 'demo';
}

export interface QuickBooksExpense {
  id: string;
  date: string;
  amount: number;
  category: string;
  vendor: string;
  description: string;
  accountId: string;
}

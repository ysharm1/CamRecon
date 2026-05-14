/**
 * Import Service
 *
 * Handles parsing, validation, and bulk creation of records from CSV/Excel files.
 * Supports import types: properties, tenants, lease_terms, expenses.
 */

import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import db from '../db';

export type ImportType = 'properties' | 'tenants' | 'lease_terms' | 'expenses';

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: ParsedRow[];
  errors: ValidationError[];
}

export interface ImportResult {
  imported: number;
  errors: ValidationError[];
}

// Required columns per import type
const REQUIRED_COLUMNS: Record<ImportType, string[]> = {
  properties: ['name', 'street', 'city', 'state', 'zip', 'total_square_footage', 'property_type'],
  tenants: ['name', 'contact_email', 'property_name', 'suite_number', 'square_footage'],
  lease_terms: ['tenant_name', 'commencement_date', 'expiration_date', 'base_rent', 'cam_cap', 'security_deposit'],
  expenses: ['property_name', 'category', 'description', 'amount', 'date'],
};

const VALID_PROPERTY_TYPES = ['commercial', 'retail', 'industrial', 'mixed'];

/**
 * Parse a file buffer (CSV or Excel) into an array of row objects.
 */
export async function parseFile(buffer: Buffer, mimeType: string): Promise<{ rows: ParsedRow[]; columns: string[] }> {
  if (mimeType === 'text/csv' || mimeType === 'application/csv') {
    return parseCsv(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return parseExcel(buffer);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

function parseCsv(buffer: Buffer): { rows: ParsedRow[]; columns: string[] } {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ParsedRow[];

  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  return { rows: records, columns };
}

async function parseExcel(buffer: Buffer): Promise<{ rows: ParsedRow[]; columns: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    return { rows: [], columns: [] };
  }

  // First row is headers
  const headerRow = worksheet.getRow(1);
  const columns: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    columns[colNumber - 1] = String(cell.value || '').trim();
  });

  const rows: ParsedRow[] = [];
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const rowObj: ParsedRow = {};
    let hasData = false;

    columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1);
      const value = cell.value;
      if (value !== null && value !== undefined && value !== '') {
        hasData = true;
        rowObj[col] = typeof value === 'object' ? String(value) : value as string | number;
      } else {
        rowObj[col] = null;
      }
    });

    if (hasData) {
      rows.push(rowObj);
    }
  }

  return { rows, columns };
}

/**
 * Validate rows against the schema for the given import type.
 */
export function validateImport(rows: ParsedRow[], importType: ImportType): ValidationResult {
  const requiredCols = REQUIRED_COLUMNS[importType];
  const valid: ParsedRow[] = [];
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    let rowValid = true;

    // Check required fields
    for (const col of requiredCols) {
      const value = row[col];
      if (value === null || value === undefined || String(value).trim() === '') {
        errors.push({ row: rowNumber, field: col, message: `${col} is required` });
        rowValid = false;
      }
    }

    // Type-specific validation
    if (rowValid) {
      const typeErrors = validateRowByType(row, importType, rowNumber);
      if (typeErrors.length > 0) {
        errors.push(...typeErrors);
        rowValid = false;
      }
    }

    if (rowValid) {
      valid.push(row);
    }
  });

  return { valid, errors };
}

function validateRowByType(row: ParsedRow, importType: ImportType, rowNumber: number): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (importType) {
    case 'properties': {
      const sqft = Number(row.total_square_footage);
      if (isNaN(sqft) || sqft <= 0) {
        errors.push({ row: rowNumber, field: 'total_square_footage', message: 'Must be a positive number' });
      }
      const pType = String(row.property_type).toLowerCase();
      if (!VALID_PROPERTY_TYPES.includes(pType)) {
        errors.push({ row: rowNumber, field: 'property_type', message: `Must be one of: ${VALID_PROPERTY_TYPES.join(', ')}` });
      }
      break;
    }
    case 'tenants': {
      const email = String(row.contact_email);
      if (!email.includes('@')) {
        errors.push({ row: rowNumber, field: 'contact_email', message: 'Must be a valid email address' });
      }
      const sqft = Number(row.square_footage);
      if (isNaN(sqft) || sqft <= 0) {
        errors.push({ row: rowNumber, field: 'square_footage', message: 'Must be a positive number' });
      }
      break;
    }
    case 'lease_terms': {
      const commDate = new Date(String(row.commencement_date));
      if (isNaN(commDate.getTime())) {
        errors.push({ row: rowNumber, field: 'commencement_date', message: 'Must be a valid date' });
      }
      const expDate = new Date(String(row.expiration_date));
      if (isNaN(expDate.getTime())) {
        errors.push({ row: rowNumber, field: 'expiration_date', message: 'Must be a valid date' });
      }
      if (!isNaN(commDate.getTime()) && !isNaN(expDate.getTime()) && commDate >= expDate) {
        errors.push({ row: rowNumber, field: 'expiration_date', message: 'Must be after commencement_date' });
      }
      const rent = Number(row.base_rent);
      if (isNaN(rent) || rent < 0) {
        errors.push({ row: rowNumber, field: 'base_rent', message: 'Must be a non-negative number' });
      }
      break;
    }
    case 'expenses': {
      const amount = Number(row.amount);
      if (isNaN(amount) || amount < 0) {
        errors.push({ row: rowNumber, field: 'amount', message: 'Must be a non-negative number' });
      }
      const date = new Date(String(row.date));
      if (isNaN(date.getTime())) {
        errors.push({ row: rowNumber, field: 'date', message: 'Must be a valid date' });
      }
      break;
    }
  }

  return errors;
}

/**
 * Execute the import — create records in bulk within a transaction.
 * Rolls back on critical errors.
 */
export async function executeImport(
  rows: ParsedRow[],
  importType: ImportType,
  organizationId: string,
): Promise<ImportResult> {
  const errors: ValidationError[] = [];
  let imported = 0;

  await db.transaction(async (trx) => {
    switch (importType) {
      case 'properties': {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          await trx('properties').insert({
            name: String(row.name),
            address: JSON.stringify({
              street: String(row.street),
              city: String(row.city),
              state: String(row.state),
              zip: String(row.zip),
            }),
            total_square_footage: Number(row.total_square_footage),
            property_type: String(row.property_type).toLowerCase(),
            owner_id: organizationId,
          });
          imported++;
        }
        break;
      }

      case 'tenants': {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Look up property by name
          const property = await trx('properties')
            .where({ name: String(row.property_name), owner_id: organizationId })
            .first();

          if (!property) {
            errors.push({
              row: i + 1,
              field: 'property_name',
              message: `Property "${row.property_name}" not found`,
            });
            continue;
          }

          await trx('tenants').insert({
            name: String(row.name),
            contact_email: String(row.contact_email),
            property_id: property.id,
            suite_number: String(row.suite_number),
            square_footage: Number(row.square_footage),
            status: 'active',
          });
          imported++;
        }
        break;
      }

      case 'lease_terms': {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Look up tenant by name
          const tenant = await trx('tenants')
            .join('properties', 'tenants.property_id', 'properties.id')
            .where({ 'tenants.name': String(row.tenant_name), 'properties.owner_id': organizationId })
            .select('tenants.id as tenant_id')
            .first();

          if (!tenant) {
            errors.push({
              row: i + 1,
              field: 'tenant_name',
              message: `Tenant "${row.tenant_name}" not found`,
            });
            continue;
          }

          await trx('lease_abstractions').insert({
            document_id: null,
            tenant_id: tenant.tenant_id,
            commencement_date: new Date(String(row.commencement_date)),
            expiration_date: new Date(String(row.expiration_date)),
            base_rent_cents: Math.round(Number(row.base_rent) * 100),
            cam_cap_cents: row.cam_cap ? Math.round(Number(row.cam_cap) * 100) : null,
            security_deposit_cents: Math.round(Number(row.security_deposit) * 100),
            confidence_score: 1.0,
            review_status: 'approved',
          });
          imported++;
        }
        break;
      }

      case 'expenses': {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Look up property by name
          const property = await trx('properties')
            .where({ name: String(row.property_name), owner_id: organizationId })
            .first();

          if (!property) {
            errors.push({
              row: i + 1,
              field: 'property_name',
              message: `Property "${row.property_name}" not found`,
            });
            continue;
          }

          // Find or create a reconciliation for this property/period
          const date = new Date(String(row.date));
          const periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

          let reconciliation = await trx('cam_reconciliations')
            .where({
              property_id: property.id,
              period_start: periodStart,
              period_end: periodEnd,
            })
            .first();

          if (!reconciliation) {
            const [newRecon] = await trx('cam_reconciliations')
              .insert({
                property_id: property.id,
                period_start: periodStart,
                period_end: periodEnd,
                total_expenses_cents: 0,
                status: 'draft',
                created_by: organizationId,
              })
              .returning('*');
            reconciliation = newRecon;
          }

          await trx('cam_line_items').insert({
            reconciliation_id: reconciliation.id,
            category: String(row.category),
            description: String(row.description),
            amount_cents: Math.round(Number(row.amount) * 100),
          });

          // Update total
          await trx('cam_reconciliations')
            .where({ id: reconciliation.id })
            .increment('total_expenses_cents', Math.round(Number(row.amount) * 100));

          imported++;
        }
        break;
      }
    }
  });

  return { imported, errors };
}

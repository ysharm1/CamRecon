/**
 * MRI Export Parser
 *
 * Parses standard MRI export formats:
 * - Tenant list: TenantID, TenantName, PropertyCode, UnitNo, LeaseFrom, LeaseTo, MonthlyRent
 * - Lease abstract export
 *
 * Maps MRI field names to the platform's standard import format.
 */

import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { ImportType, ParsedRow } from '../import.service';

export interface MriParseResult {
  rows: ParsedRow[];
  importType: ImportType;
  mappedColumns: Record<string, string>;
}

// MRI column mappings (MRI name → platform name)
const MRI_COLUMN_MAPPING: Record<string, string> = {
  'TenantID': 'tenant_id',
  'Tenant ID': 'tenant_id',
  'TenantName': 'name',
  'Tenant Name': 'name',
  'Tenant': 'name',
  'PropertyCode': 'property_name',
  'Property Code': 'property_name',
  'Property': 'property_name',
  'PropertyName': 'property_name',
  'Property Name': 'property_name',
  'UnitNo': 'suite_number',
  'Unit No': 'suite_number',
  'Unit Number': 'suite_number',
  'Unit': 'suite_number',
  'Suite': 'suite_number',
  'LeaseFrom': 'commencement_date',
  'Lease From': 'commencement_date',
  'LeaseStart': 'commencement_date',
  'Lease Start': 'commencement_date',
  'Start Date': 'commencement_date',
  'LeaseTo': 'expiration_date',
  'Lease To': 'expiration_date',
  'LeaseEnd': 'expiration_date',
  'Lease End': 'expiration_date',
  'End Date': 'expiration_date',
  'MonthlyRent': 'base_rent',
  'Monthly Rent': 'base_rent',
  'Rent': 'base_rent',
  'BaseRent': 'base_rent',
  'Base Rent': 'base_rent',
  'SqFt': 'square_footage',
  'Sqft': 'square_footage',
  'Square Feet': 'square_footage',
  'Area': 'square_footage',
  'Email': 'contact_email',
  'ContactEmail': 'contact_email',
  'Contact Email': 'contact_email',
  'TenantEmail': 'contact_email',
  'Status': 'status',
  'LeaseStatus': 'status',
  'Lease Status': 'status',
  'CAMCap': 'cam_cap',
  'CAM Cap': 'cam_cap',
  'SecurityDeposit': 'security_deposit',
  'Security Deposit': 'security_deposit',
  'Deposit': 'security_deposit',
  'Category': 'category',
  'ExpenseCategory': 'category',
  'Description': 'description',
  'Amount': 'amount',
  'Date': 'date',
  'ExpenseDate': 'date',
};

/**
 * Parse an MRI export file and map columns to platform schema.
 */
export async function parseMriExport(buffer: Buffer, mimeType: string): Promise<MriParseResult> {
  const rawRows = await parseRawFile(buffer, mimeType);

  if (rawRows.length === 0) {
    return { rows: [], importType: 'tenants', mappedColumns: {} };
  }

  // Detect the import type based on available columns
  const sourceColumns = Object.keys(rawRows[0]);
  const { importType, mappedColumns } = detectMriImportType(sourceColumns);

  // Map rows to platform format
  const rows = rawRows.map((row) => {
    const mapped: ParsedRow = {};
    for (const [sourceCol, value] of Object.entries(row)) {
      const targetCol = MRI_COLUMN_MAPPING[sourceCol];
      if (targetCol) {
        mapped[targetCol] = value as string | number | null;
      }
    }
    return mapped;
  });

  return { rows, importType, mappedColumns };
}

function detectMriImportType(columns: string[]): { importType: ImportType; mappedColumns: Record<string, string> } {
  const mappedColumns: Record<string, string> = {};
  const mappedTargets = new Set<string>();

  for (const col of columns) {
    const target = MRI_COLUMN_MAPPING[col];
    if (target) {
      mappedColumns[col] = target;
      mappedTargets.add(target);
    }
  }

  // Determine import type based on which fields are present
  if (mappedTargets.has('category') && mappedTargets.has('amount') && mappedTargets.has('date')) {
    return { importType: 'expenses', mappedColumns };
  }

  if (mappedTargets.has('commencement_date') && mappedTargets.has('expiration_date') && mappedTargets.has('base_rent')) {
    return { importType: 'lease_terms', mappedColumns };
  }

  if (mappedTargets.has('name') && mappedTargets.has('suite_number')) {
    return { importType: 'tenants', mappedColumns };
  }

  // Default to tenants
  return { importType: 'tenants', mappedColumns };
}

async function parseRawFile(buffer: Buffer, mimeType: string): Promise<ParsedRow[]> {
  if (mimeType === 'text/csv' || mimeType === 'application/csv') {
    return parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as ParsedRow[];
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet || worksheet.rowCount === 0) {
      return [];
    }

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

    return rows;
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

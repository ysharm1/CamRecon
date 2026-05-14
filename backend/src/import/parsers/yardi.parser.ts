/**
 * Yardi Export Parser
 *
 * Parses standard Yardi export formats:
 * - Rent roll CSV: Unit, Tenant, Lease Start, Lease End, Rent, SqFt, Status
 * - Charge code mapping
 *
 * Maps Yardi field names to the platform's standard import format.
 */

import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { ImportType, ParsedRow } from '../import.service';

export interface YardiParseResult {
  rows: ParsedRow[];
  importType: ImportType;
  mappedColumns: Record<string, string>;
}

// Yardi rent roll column mappings (Yardi name → platform name)
const YARDI_RENT_ROLL_MAPPING: Record<string, string> = {
  'Unit': 'suite_number',
  'UnitCode': 'suite_number',
  'Unit Code': 'suite_number',
  'Tenant': 'name',
  'TenantName': 'name',
  'Tenant Name': 'name',
  'Lease Start': 'commencement_date',
  'LeaseStart': 'commencement_date',
  'Lease From': 'commencement_date',
  'MoveIn': 'commencement_date',
  'Move In': 'commencement_date',
  'Lease End': 'expiration_date',
  'LeaseEnd': 'expiration_date',
  'Lease To': 'expiration_date',
  'MoveOut': 'expiration_date',
  'Move Out': 'expiration_date',
  'Rent': 'base_rent',
  'MonthlyRent': 'base_rent',
  'Monthly Rent': 'base_rent',
  'Base Rent': 'base_rent',
  'SqFt': 'square_footage',
  'Sqft': 'square_footage',
  'Square Feet': 'square_footage',
  'Square Footage': 'square_footage',
  'Status': 'status',
  'LeaseStatus': 'status',
  'Lease Status': 'status',
  'Email': 'contact_email',
  'TenantEmail': 'contact_email',
  'Tenant Email': 'contact_email',
  'Contact Email': 'contact_email',
  'Property': 'property_name',
  'PropertyName': 'property_name',
  'Property Name': 'property_name',
  'Building': 'property_name',
  'CAM Cap': 'cam_cap',
  'CamCap': 'cam_cap',
  'Security Deposit': 'security_deposit',
  'SecurityDeposit': 'security_deposit',
  'Deposit': 'security_deposit',
};

/**
 * Parse a Yardi export file and map columns to platform schema.
 */
export async function parseYardiExport(buffer: Buffer, mimeType: string): Promise<YardiParseResult> {
  const rawRows = await parseRawFile(buffer, mimeType);

  if (rawRows.length === 0) {
    return { rows: [], importType: 'tenants', mappedColumns: {} };
  }

  // Detect the import type based on available columns
  const sourceColumns = Object.keys(rawRows[0]);
  const { importType, mappedColumns } = detectYardiImportType(sourceColumns);

  // Map rows to platform format
  const rows = rawRows.map((row) => {
    const mapped: ParsedRow = {};
    for (const [sourceCol, value] of Object.entries(row)) {
      const targetCol = YARDI_RENT_ROLL_MAPPING[sourceCol];
      if (targetCol) {
        mapped[targetCol] = value as string | number | null;
      }
    }
    return mapped;
  });

  return { rows, importType, mappedColumns };
}

function detectYardiImportType(columns: string[]): { importType: ImportType; mappedColumns: Record<string, string> } {
  const mappedColumns: Record<string, string> = {};
  const mappedTargets = new Set<string>();

  for (const col of columns) {
    const target = YARDI_RENT_ROLL_MAPPING[col];
    if (target) {
      mappedColumns[col] = target;
      mappedTargets.add(target);
    }
  }

  // Determine import type based on which fields are present
  if (mappedTargets.has('commencement_date') && mappedTargets.has('expiration_date') && mappedTargets.has('base_rent')) {
    return { importType: 'lease_terms', mappedColumns };
  }

  if (mappedTargets.has('name') && mappedTargets.has('suite_number')) {
    return { importType: 'tenants', mappedColumns };
  }

  // Default to tenants for rent roll format
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

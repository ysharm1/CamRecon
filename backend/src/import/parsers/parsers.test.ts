/**
 * Parser Tests
 *
 * Tests for Yardi and MRI export parsers.
 */

import { describe, it, expect } from 'vitest';
import { parseYardiExport } from './yardi.parser';
import { parseMriExport } from './mri.parser';

describe('Yardi Parser', () => {
  it('should parse a Yardi rent roll CSV and map columns', async () => {
    const csv = `Unit,Tenant,Lease Start,Lease End,Rent,SqFt,Status
101,Acme Corp,2024-01-01,2029-01-01,5000,2500,Active
102,Beta Inc,2023-06-01,2028-06-01,3500,1800,Active`;

    const buffer = Buffer.from(csv);
    const result = await parseYardiExport(buffer, 'text/csv');

    expect(result.rows).toHaveLength(2);
    expect(result.importType).toBe('lease_terms');
    expect(result.rows[0].name).toBe('Acme Corp');
    expect(result.rows[0].suite_number).toBe('101');
    expect(result.rows[0].commencement_date).toBe('2024-01-01');
    expect(result.rows[0].expiration_date).toBe('2029-01-01');
    expect(result.rows[0].base_rent).toBe('5000');
    expect(result.rows[0].square_footage).toBe('2500');
  });

  it('should detect tenant import type when no lease dates present', async () => {
    const csv = `Unit,Tenant,SqFt,Status,Email
101,Acme Corp,2500,Active,acme@example.com
102,Beta Inc,1800,Active,beta@example.com`;

    const buffer = Buffer.from(csv);
    const result = await parseYardiExport(buffer, 'text/csv');

    expect(result.rows).toHaveLength(2);
    expect(result.importType).toBe('tenants');
    expect(result.rows[0].name).toBe('Acme Corp');
    expect(result.rows[0].suite_number).toBe('101');
    expect(result.rows[0].contact_email).toBe('acme@example.com');
  });

  it('should return empty result for empty file', async () => {
    const csv = '';
    const buffer = Buffer.from(csv);
    const result = await parseYardiExport(buffer, 'text/csv');

    expect(result.rows).toHaveLength(0);
    expect(result.importType).toBe('tenants');
  });

  it('should map Yardi column name variants', async () => {
    const csv = `UnitCode,TenantName,LeaseStart,LeaseEnd,MonthlyRent,Square Feet
A-101,Delta LLC,2024-03-01,2027-03-01,4200,3000`;

    const buffer = Buffer.from(csv);
    const result = await parseYardiExport(buffer, 'text/csv');

    expect(result.rows[0].suite_number).toBe('A-101');
    expect(result.rows[0].name).toBe('Delta LLC');
    expect(result.rows[0].commencement_date).toBe('2024-03-01');
    expect(result.rows[0].base_rent).toBe('4200');
    expect(result.rows[0].square_footage).toBe('3000');
  });
});

describe('MRI Parser', () => {
  it('should parse an MRI tenant list CSV and map columns', async () => {
    const csv = `TenantID,TenantName,PropertyCode,UnitNo,LeaseFrom,LeaseTo,MonthlyRent
T001,Acme Corp,PROP-A,101,2024-01-01,2029-01-01,5000
T002,Beta Inc,PROP-A,102,2023-06-01,2028-06-01,3500`;

    const buffer = Buffer.from(csv);
    const result = await parseMriExport(buffer, 'text/csv');

    expect(result.rows).toHaveLength(2);
    expect(result.importType).toBe('lease_terms');
    expect(result.rows[0].name).toBe('Acme Corp');
    expect(result.rows[0].property_name).toBe('PROP-A');
    expect(result.rows[0].suite_number).toBe('101');
    expect(result.rows[0].commencement_date).toBe('2024-01-01');
    expect(result.rows[0].expiration_date).toBe('2029-01-01');
    expect(result.rows[0].base_rent).toBe('5000');
  });

  it('should detect expense import type', async () => {
    const csv = `Property,Category,Description,Amount,Date
Office Park A,Maintenance,HVAC repair,1500,2024-03-15
Office Park A,Utilities,Electric bill,800,2024-03-01`;

    const buffer = Buffer.from(csv);
    const result = await parseMriExport(buffer, 'text/csv');

    expect(result.rows).toHaveLength(2);
    expect(result.importType).toBe('expenses');
    expect(result.rows[0].property_name).toBe('Office Park A');
    expect(result.rows[0].category).toBe('Maintenance');
    expect(result.rows[0].amount).toBe('1500');
    expect(result.rows[0].date).toBe('2024-03-15');
  });

  it('should detect tenant import type when only tenant fields present', async () => {
    const csv = `TenantName,PropertyCode,UnitNo,SqFt,Email
Acme Corp,PROP-A,101,2500,acme@example.com
Beta Inc,PROP-A,102,1800,beta@example.com`;

    const buffer = Buffer.from(csv);
    const result = await parseMriExport(buffer, 'text/csv');

    expect(result.rows).toHaveLength(2);
    expect(result.importType).toBe('tenants');
    expect(result.rows[0].name).toBe('Acme Corp');
    expect(result.rows[0].suite_number).toBe('101');
    expect(result.rows[0].square_footage).toBe('2500');
  });

  it('should return empty result for empty file', async () => {
    const csv = '';
    const buffer = Buffer.from(csv);
    const result = await parseMriExport(buffer, 'text/csv');

    expect(result.rows).toHaveLength(0);
    expect(result.importType).toBe('tenants');
  });

  it('should handle MRI column name variants', async () => {
    const csv = `Tenant Name,Property Name,Unit Number,Lease Start,Lease End,Base Rent,Square Feet
Gamma LLC,Tower B,301,2024-05-01,2029-05-01,6000,4000`;

    const buffer = Buffer.from(csv);
    const result = await parseMriExport(buffer, 'text/csv');

    expect(result.rows[0].name).toBe('Gamma LLC');
    expect(result.rows[0].property_name).toBe('Tower B');
    expect(result.rows[0].suite_number).toBe('301');
    expect(result.rows[0].commencement_date).toBe('2024-05-01');
    expect(result.rows[0].base_rent).toBe('6000');
  });
});

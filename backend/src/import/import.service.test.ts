/**
 * Import Service Tests
 *
 * Tests for CSV/Excel parsing, validation, and import type detection.
 */

import { describe, it, expect } from 'vitest';
import { validateImport, ParsedRow } from './import.service';

describe('Import Service', () => {
  describe('validateImport - properties', () => {
    it('should validate valid property rows', () => {
      const rows: ParsedRow[] = [
        {
          name: 'Office Park A',
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zip: '78701',
          total_square_footage: 50000,
          property_type: 'commercial',
        },
      ];

      const result = validateImport(rows, 'properties');
      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject rows with missing required fields', () => {
      const rows: ParsedRow[] = [
        {
          name: 'Office Park A',
          street: '',
          city: 'Austin',
          state: 'TX',
          zip: '78701',
          total_square_footage: 50000,
          property_type: 'commercial',
        },
      ];

      const result = validateImport(rows, 'properties');
      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('street');
    });

    it('should reject invalid property_type', () => {
      const rows: ParsedRow[] = [
        {
          name: 'Office Park A',
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zip: '78701',
          total_square_footage: 50000,
          property_type: 'residential',
        },
      ];

      const result = validateImport(rows, 'properties');
      expect(result.valid).toHaveLength(0);
      expect(result.errors.some((e) => e.field === 'property_type')).toBe(true);
    });

    it('should reject non-positive square footage', () => {
      const rows: ParsedRow[] = [
        {
          name: 'Office Park A',
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zip: '78701',
          total_square_footage: -100,
          property_type: 'commercial',
        },
      ];

      const result = validateImport(rows, 'properties');
      expect(result.valid).toHaveLength(0);
      expect(result.errors.some((e) => e.field === 'total_square_footage')).toBe(true);
    });
  });

  describe('validateImport - tenants', () => {
    it('should validate valid tenant rows', () => {
      const rows: ParsedRow[] = [
        {
          name: 'Acme Corp',
          contact_email: 'contact@acme.com',
          property_name: 'Office Park A',
          suite_number: '101',
          square_footage: 2500,
        },
      ];

      const result = validateImport(rows, 'tenants');
      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email', () => {
      const rows: ParsedRow[] = [
        {
          name: 'Acme Corp',
          contact_email: 'not-an-email',
          property_name: 'Office Park A',
          suite_number: '101',
          square_footage: 2500,
        },
      ];

      const result = validateImport(rows, 'tenants');
      expect(result.valid).toHaveLength(0);
      expect(result.errors.some((e) => e.field === 'contact_email')).toBe(true);
    });
  });

  describe('validateImport - lease_terms', () => {
    it('should validate valid lease term rows', () => {
      const rows: ParsedRow[] = [
        {
          tenant_name: 'Acme Corp',
          commencement_date: '2024-01-01',
          expiration_date: '2029-01-01',
          base_rent: 5000,
          cam_cap: 500,
          security_deposit: 10000,
        },
      ];

      const result = validateImport(rows, 'lease_terms');
      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject expiration before commencement', () => {
      const rows: ParsedRow[] = [
        {
          tenant_name: 'Acme Corp',
          commencement_date: '2029-01-01',
          expiration_date: '2024-01-01',
          base_rent: 5000,
          cam_cap: 500,
          security_deposit: 10000,
        },
      ];

      const result = validateImport(rows, 'lease_terms');
      expect(result.valid).toHaveLength(0);
      expect(result.errors.some((e) => e.field === 'expiration_date')).toBe(true);
    });

    it('should reject invalid dates', () => {
      const rows: ParsedRow[] = [
        {
          tenant_name: 'Acme Corp',
          commencement_date: 'not-a-date',
          expiration_date: '2029-01-01',
          base_rent: 5000,
          cam_cap: 500,
          security_deposit: 10000,
        },
      ];

      const result = validateImport(rows, 'lease_terms');
      expect(result.valid).toHaveLength(0);
      expect(result.errors.some((e) => e.field === 'commencement_date')).toBe(true);
    });
  });

  describe('validateImport - expenses', () => {
    it('should validate valid expense rows', () => {
      const rows: ParsedRow[] = [
        {
          property_name: 'Office Park A',
          category: 'Maintenance',
          description: 'HVAC repair',
          amount: 1500,
          date: '2024-03-15',
        },
      ];

      const result = validateImport(rows, 'expenses');
      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative amounts', () => {
      const rows: ParsedRow[] = [
        {
          property_name: 'Office Park A',
          category: 'Maintenance',
          description: 'HVAC repair',
          amount: -100,
          date: '2024-03-15',
        },
      ];

      const result = validateImport(rows, 'expenses');
      expect(result.valid).toHaveLength(0);
      expect(result.errors.some((e) => e.field === 'amount')).toBe(true);
    });

    it('should reject invalid dates', () => {
      const rows: ParsedRow[] = [
        {
          property_name: 'Office Park A',
          category: 'Maintenance',
          description: 'HVAC repair',
          amount: 1500,
          date: 'invalid',
        },
      ];

      const result = validateImport(rows, 'expenses');
      expect(result.valid).toHaveLength(0);
      expect(result.errors.some((e) => e.field === 'date')).toBe(true);
    });
  });

  describe('validateImport - multiple rows', () => {
    it('should separate valid and invalid rows', () => {
      const rows: ParsedRow[] = [
        {
          name: 'Valid Property',
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zip: '78701',
          total_square_footage: 50000,
          property_type: 'commercial',
        },
        {
          name: 'Invalid Property',
          street: '456 Oak Ave',
          city: 'Austin',
          state: 'TX',
          zip: '78702',
          total_square_footage: 'not-a-number',
          property_type: 'commercial',
        },
        {
          name: 'Another Valid',
          street: '789 Elm St',
          city: 'Dallas',
          state: 'TX',
          zip: '75201',
          total_square_footage: 30000,
          property_type: 'retail',
        },
      ];

      const result = validateImport(rows, 'properties');
      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(2);
    });
  });
});

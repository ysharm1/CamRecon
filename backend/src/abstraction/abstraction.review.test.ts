import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { abstractionService, calculateOverallConfidence } from './abstraction.service';
import { ExtractedTerm } from './abstraction.types';

// Mock the database module
vi.mock('../db', () => {
  const mockDb: any = vi.fn((tableName: string) => mockDb._table(tableName));
  mockDb._table = vi.fn(() => mockDb);
  mockDb.where = vi.fn(() => mockDb);
  mockDb.orderBy = vi.fn(() => mockDb);
  mockDb.first = vi.fn(() => Promise.resolve(null));
  mockDb.insert = vi.fn(() => Promise.resolve());
  mockDb.update = vi.fn(() => Promise.resolve());
  mockDb.select = vi.fn(() => Promise.resolve([]));
  return { default: mockDb };
});

import db from '../db';

const mockDb = db as any;

describe('abstraction review workflow', () => {
  const sampleTerms: ExtractedTerm[] = [
    { fieldName: 'tenant_name', value: 'Acme Corp', confidence: 0.95, sourcePageNumber: 1, sourceText: 'Tenant: Acme Corp' },
    { fieldName: 'commencement_date', value: '2024-01-01', confidence: 0.90, sourcePageNumber: 1, sourceText: 'commencing Jan 1' },
    { fieldName: 'expiration_date', value: '2029-12-31', confidence: 0.88, sourcePageNumber: 1, sourceText: 'expiring Dec 31' },
    { fieldName: 'base_rent', value: '5000', confidence: 0.85, sourcePageNumber: 3, sourceText: '$5,000 monthly' },
    { fieldName: 'premises_description', value: 'Suite 200', confidence: 0.80, sourcePageNumber: 2, sourceText: 'Suite 200' },
  ];

  const sampleRecord = {
    id: 'abs-001',
    document_id: 'doc-001',
    tenant_id: 'tenant-001',
    commencement_date: '2024-01-01',
    expiration_date: '2029-12-31',
    base_rent_cents: 500000,
    rent_escalation: JSON.stringify(null),
    cam_cap_cents: null,
    security_deposit_cents: 1000000,
    renewal_options: JSON.stringify([]),
    extracted_terms: JSON.stringify(sampleTerms),
    confidence_score: 0.876,
    review_status: 'pending',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock chain
    mockDb.mockImplementation(() => mockDb);
    mockDb._table.mockImplementation(() => mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.first.mockResolvedValue(null);
    mockDb.insert.mockResolvedValue(undefined);
    mockDb.update.mockResolvedValue(undefined);
  });

  describe('listPendingAbstractions', () => {
    it('should return all abstractions with pending review status', async () => {
      const pendingRecords = [sampleRecord, { ...sampleRecord, id: 'abs-002', document_id: 'doc-002' }];
      mockDb.orderBy.mockResolvedValue(pendingRecords);

      const results = await abstractionService.listPendingAbstractions();

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('abs-001');
      expect(results[0].extracted_terms).toEqual(sampleTerms);
      expect(results[1].id).toBe('abs-002');
    });

    it('should return empty array when no pending abstractions exist', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      const results = await abstractionService.listPendingAbstractions();

      expect(results).toHaveLength(0);
    });

    it('should parse JSON fields in returned records', async () => {
      mockDb.orderBy.mockResolvedValue([sampleRecord]);

      const results = await abstractionService.listPendingAbstractions();

      expect(results[0].extracted_terms).toEqual(sampleTerms);
      expect(results[0].renewal_options).toEqual([]);
      expect(results[0].rent_escalation).toBeNull();
    });
  });

  describe('approveAbstraction', () => {
    it('should set review_status to approved', async () => {
      const approvedRecord = { ...sampleRecord, review_status: 'approved' };
      mockDb.first
        .mockResolvedValueOnce(sampleRecord) // First call: check existence
        .mockResolvedValueOnce(approvedRecord); // Second call: return updated

      const result = await abstractionService.approveAbstraction('abs-001');

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ review_status: 'approved' })
      );
      expect(result.review_status).toBe('approved');
    });

    it('should throw AppError 404 when abstraction not found', async () => {
      mockDb.first.mockResolvedValue(null);

      await expect(abstractionService.approveAbstraction('nonexistent'))
        .rejects.toMatchObject({
          statusCode: 404,
          code: 'ABSTRACTION_NOT_FOUND',
        });
    });
  });

  describe('correctAbstraction', () => {
    it('should update existing term values with corrections', async () => {
      const updatedRecord = {
        ...sampleRecord,
        review_status: 'approved',
        extracted_terms: JSON.stringify([
          ...sampleTerms.slice(0, 3),
          { ...sampleTerms[3], value: '6000', confidence: 1.0 },
          sampleTerms[4],
        ]),
      };
      mockDb.first
        .mockResolvedValueOnce(sampleRecord)
        .mockResolvedValueOnce(updatedRecord);

      const corrections = [{ fieldName: 'base_rent', newValue: '6000' }];
      const result = await abstractionService.correctAbstraction('abs-001', corrections);

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          review_status: 'approved',
        })
      );
      expect(result.review_status).toBe('approved');
    });

    it('should add new terms when correction fieldName does not exist', async () => {
      mockDb.first
        .mockResolvedValueOnce(sampleRecord)
        .mockResolvedValueOnce({ ...sampleRecord, review_status: 'approved' });

      const corrections = [{ fieldName: 'new_field', newValue: 'new_value' }];
      await abstractionService.correctAbstraction('abs-001', corrections);

      // Verify update was called with extracted_terms containing the new field
      const updateCall = mockDb.update.mock.calls[0][0];
      const updatedTerms = JSON.parse(updateCall.extracted_terms);
      const newTerm = updatedTerms.find((t: any) => t.fieldName === 'new_field');
      expect(newTerm).toBeDefined();
      expect(newTerm.value).toBe('new_value');
      expect(newTerm.confidence).toBe(1.0);
    });

    it('should recalculate confidence score after corrections', async () => {
      mockDb.first
        .mockResolvedValueOnce(sampleRecord)
        .mockResolvedValueOnce({ ...sampleRecord, review_status: 'approved' });

      const corrections = [{ fieldName: 'base_rent', newValue: '6000' }];
      await abstractionService.correctAbstraction('abs-001', corrections);

      const updateCall = mockDb.update.mock.calls[0][0];
      // After correcting base_rent to confidence 1.0, the new mean should be higher
      // Original: (0.95 + 0.90 + 0.88 + 0.85 + 0.80) / 5 = 0.876
      // After: (0.95 + 0.90 + 0.88 + 1.0 + 0.80) / 5 = 0.906
      expect(updateCall.confidence_score).toBeCloseTo(0.906, 2);
    });

    it('should throw AppError 404 when abstraction not found', async () => {
      mockDb.first.mockResolvedValue(null);

      await expect(
        abstractionService.correctAbstraction('nonexistent', [{ fieldName: 'x', newValue: 'y' }])
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'ABSTRACTION_NOT_FOUND',
      });
    });
  });

  describe('rejectAbstraction', () => {
    it('should set review_status to needs_correction', async () => {
      const rejectedRecord = { ...sampleRecord, review_status: 'needs_correction' };
      mockDb.first
        .mockResolvedValueOnce(sampleRecord)
        .mockResolvedValueOnce(rejectedRecord);

      const result = await abstractionService.rejectAbstraction('abs-001');

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({ review_status: 'needs_correction' })
      );
      expect(result.review_status).toBe('needs_correction');
    });

    it('should throw AppError 404 when abstraction not found', async () => {
      mockDb.first.mockResolvedValue(null);

      await expect(abstractionService.rejectAbstraction('nonexistent'))
        .rejects.toMatchObject({
          statusCode: 404,
          code: 'ABSTRACTION_NOT_FOUND',
        });
    });
  });
});

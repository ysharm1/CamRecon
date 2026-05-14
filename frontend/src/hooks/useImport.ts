/**
 * useImport Hook
 *
 * Provides mutations for the import API: upload, validate, and execute.
 */

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface UploadResponse {
  data: {
    rows: ParsedRow[];
    columns: string[];
    totalRows: number;
    fileName: string;
  };
}

export interface ValidateResponse {
  data: {
    validCount: number;
    errorCount: number;
    valid: ParsedRow[];
    errors: ValidationError[];
  };
}

export interface ExecuteResponse {
  data: {
    imported: number;
    errors: ValidationError[];
  };
}

export interface ParserResponse {
  data: {
    rows: ParsedRow[];
    importType: string;
    totalRows: number;
    mappedColumns: Record<string, string>;
  };
}

export type ImportType = 'properties' | 'tenants' | 'lease_terms' | 'expenses';

export function useImportUpload() {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<UploadResponse>('/api/import/upload', formData);
    },
  });
}

export function useImportValidate() {
  return useMutation({
    mutationFn: async ({ rows, importType }: { rows: ParsedRow[]; importType: ImportType }): Promise<ValidateResponse> => {
      return api.post<ValidateResponse>('/api/import/validate', { rows, importType });
    },
  });
}

export function useImportExecute() {
  return useMutation({
    mutationFn: async ({ rows, importType }: { rows: ParsedRow[]; importType: ImportType }): Promise<ExecuteResponse> => {
      return api.post<ExecuteResponse>('/api/import/execute', { rows, importType });
    },
  });
}

export function useParseYardi() {
  return useMutation({
    mutationFn: async (file: File): Promise<ParserResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<ParserResponse>('/api/import/parse-yardi', formData);
    },
  });
}

export function useParseMri() {
  return useMutation({
    mutationFn: async (file: File): Promise<ParserResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload<ParserResponse>('/api/import/parse-mri', formData);
    },
  });
}

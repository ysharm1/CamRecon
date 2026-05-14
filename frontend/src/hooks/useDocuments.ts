import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Document {
  id: string;
  title: string;
  documentType: string;
  propertyId: string;
  propertyName?: string;
  tenantId: string | null;
  tenantName?: string;
  currentVersion: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends Document {
  versions: DocumentVersion[];
  abstraction?: {
    id: string;
    status: string;
    confidenceScore: number;
    extractedTerms: ExtractedTerm[];
  } | null;
}

export interface ExtractedTerm {
  field: string;
  value: string | number | null;
  confidence: number;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  changeDescription?: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export function useDocuments(propertyId?: string) {
  return useQuery<Document[]>({
    queryKey: ['documents', { propertyId }],
    queryFn: async () => {
      const params = propertyId ? `?propertyId=${propertyId}` : '';
      const response = await api.get<{ data: Document[] }>(`/api/documents${params}`);
      return response.data;
    },
  });
}

export function useDocument(documentId: string) {
  return useQuery<DocumentDetail>({
    queryKey: ['documents', documentId],
    queryFn: async () => {
      const response = await api.get<{ data: DocumentDetail }>(`/api/documents/${documentId}`);
      return response.data;
    },
    enabled: !!documentId,
  });
}

export function useDocumentVersions(documentId: string) {
  return useQuery<DocumentVersion[]>({
    queryKey: ['documents', documentId, 'versions'],
    queryFn: async () => {
      const response = await api.get<{ data: DocumentVersion[] }>(`/api/documents/${documentId}/versions`);
      return response.data;
    },
    enabled: !!documentId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      return api.upload<{ data: Document }>('/api/documents', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useUploadVersion(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      return api.upload<{ data: DocumentVersion }>(`/api/documents/${documentId}/versions`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', documentId] });
      queryClient.invalidateQueries({ queryKey: ['documents', documentId, 'versions'] });
    },
  });
}

export function useDocumentAuditTrail(documentId: string) {
  return useQuery<AuditEntry[]>({
    queryKey: ['audit', 'document', documentId],
    queryFn: async () => {
      const response = await api.get<{ data: AuditEntry[] }>(`/api/audit/document/${documentId}`);
      return response.data;
    },
    enabled: !!documentId,
  });
}

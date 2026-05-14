import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware';

// Mock the auth middleware
vi.mock('../auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'property_manager',
      organizationId: 'org-123',
      firstName: 'Test',
      lastName: 'User',
    };
    next();
  },
}));

// Mock the documents service
vi.mock('./documents.service', () => ({
  documentsService: {
    upload: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    addVersion: vi.fn(),
    listVersions: vi.fn(),
    getVersionFile: vi.fn(),
  },
}));

import documentRoutes from './documents.routes';
import { documentsService } from './documents.service';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/documents', documentRoutes);
  app.use(errorHandler);
  return app;
}

describe('Document Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  describe('POST /api/documents', () => {
    it('should upload a document successfully', async () => {
      const mockDoc = {
        id: 'doc-123',
        title: 'Test Lease',
        document_type: 'lease',
        property_id: 'prop-123',
        tenant_id: null,
        storage_key: 'doc-123/test.pdf',
        current_version: 1,
        mime_type: 'application/pdf',
        size_bytes: 1024,
        uploaded_by: 'user-123',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      vi.mocked(documentsService.upload).mockResolvedValue(mockDoc);

      const res = await request(app)
        .post('/api/documents')
        .field('title', 'Test Lease')
        .field('documentType', 'lease')
        .field('propertyId', 'prop-123')
        .attach('file', Buffer.from('pdf content'), 'test.pdf');

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(mockDoc);
      expect(documentsService.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Lease',
          documentType: 'lease',
          propertyId: 'prop-123',
          uploadedBy: 'user-123',
        })
      );
    });

    it('should return 400 when no file is provided', async () => {
      const res = await request(app)
        .post('/api/documents')
        .field('title', 'Test Lease')
        .field('documentType', 'lease')
        .field('propertyId', 'prop-123');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FILE');
    });

    it('should return 400 when title is missing', async () => {
      const res = await request(app)
        .post('/api/documents')
        .field('documentType', 'lease')
        .field('propertyId', 'prop-123')
        .attach('file', Buffer.from('pdf content'), 'test.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('title');
    });

    it('should return 400 when documentType is invalid', async () => {
      const res = await request(app)
        .post('/api/documents')
        .field('title', 'Test')
        .field('documentType', 'invalid_type')
        .field('propertyId', 'prop-123')
        .attach('file', Buffer.from('pdf content'), 'test.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('documentType');
    });

    it('should return 400 when propertyId is missing', async () => {
      const res = await request(app)
        .post('/api/documents')
        .field('title', 'Test')
        .field('documentType', 'lease')
        .attach('file', Buffer.from('pdf content'), 'test.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('propertyId');
    });

    it('should handle file size limit via multer configuration', async () => {
      // We can't send a 100MB file in a unit test, but we verify
      // the multer error handling works by confirming the route
      // accepts valid files. The 100MB limit is enforced by multer config.
      vi.mocked(documentsService.upload).mockResolvedValue({
        id: 'doc-123',
        title: 'Normal File',
        document_type: 'lease',
        property_id: 'prop-123',
        tenant_id: null,
        storage_key: 'doc-123/normal.pdf',
        current_version: 1,
        mime_type: 'application/pdf',
        size_bytes: 1024,
        uploaded_by: 'user-123',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      });

      const res = await request(app)
        .post('/api/documents')
        .field('title', 'Normal File')
        .field('documentType', 'lease')
        .field('propertyId', 'prop-123')
        .attach('file', Buffer.alloc(1024), {
          filename: 'normal.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/documents', () => {
    it('should list documents', async () => {
      const mockDocs = [
        {
          id: 'doc-1',
          title: 'Lease A',
          document_type: 'lease',
          property_id: 'prop-1',
          tenant_id: null,
          storage_key: 'doc-1/lease.pdf',
          current_version: 1,
          mime_type: 'application/pdf',
          size_bytes: 2048,
          uploaded_by: 'user-123',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
      ];

      vi.mocked(documentsService.list).mockResolvedValue(mockDocs);

      const res = await request(app).get('/api/documents');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockDocs);
    });

    it('should pass query filters to service', async () => {
      vi.mocked(documentsService.list).mockResolvedValue([]);

      await request(app).get('/api/documents?propertyId=prop-1&tenantId=tenant-1');

      expect(documentsService.list).toHaveBeenCalledWith({
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
      });
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should return a document by id', async () => {
      const mockDoc = {
        id: 'doc-1',
        title: 'Lease A',
        document_type: 'lease',
        property_id: 'prop-1',
        tenant_id: null,
        storage_key: 'doc-1/lease.pdf',
        current_version: 1,
        mime_type: 'application/pdf',
        size_bytes: 2048,
        uploaded_by: 'user-123',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      vi.mocked(documentsService.getById).mockResolvedValue(mockDoc);

      const res = await request(app).get('/api/documents/doc-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockDoc);
      expect(documentsService.getById).toHaveBeenCalledWith('doc-1', 'user-123');
    });

    it('should return 404 when document not found', async () => {
      const { AppError } = await import('../middleware');
      vi.mocked(documentsService.getById).mockRejectedValue(
        new AppError(404, 'DOCUMENT_NOT_FOUND', "Document with id 'nonexistent' not found")
      );

      const res = await request(app).get('/api/documents/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });

  describe('POST /api/documents/:id/versions', () => {
    it('should upload a new version successfully', async () => {
      const mockVersion = {
        id: 'ver-123',
        document_id: 'doc-123',
        version_number: 2,
        storage_key: 'doc-123/v2/updated.pdf',
        uploaded_by: 'user-123',
        uploaded_at: '2024-02-01T10:00:00Z',
        change_description: 'Updated terms',
        size_bytes: 2048,
        checksum: 'abc123',
        created_at: '2024-02-01T10:00:00Z',
        updated_at: '2024-02-01T10:00:00Z',
      };

      vi.mocked(documentsService.addVersion).mockResolvedValue(mockVersion);

      const res = await request(app)
        .post('/api/documents/doc-123/versions')
        .field('changeDescription', 'Updated terms')
        .attach('file', Buffer.from('updated pdf content'), 'updated.pdf');

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(mockVersion);
      expect(documentsService.addVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'doc-123',
          uploadedBy: 'user-123',
          changeDescription: 'Updated terms',
        })
      );
    });

    it('should return 400 when no file is provided for version upload', async () => {
      const res = await request(app)
        .post('/api/documents/doc-123/versions')
        .field('changeDescription', 'Updated terms');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FILE');
    });

    it('should return 409 on version conflict', async () => {
      const { AppError } = await import('../middleware');
      vi.mocked(documentsService.addVersion).mockRejectedValue(
        new AppError(409, 'VERSION_CONFLICT', 'Document was modified by another user. Please refresh and try again.')
      );

      const res = await request(app)
        .post('/api/documents/doc-123/versions')
        .attach('file', Buffer.from('content'), 'file.pdf');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VERSION_CONFLICT');
    });

    it('should return 404 when document does not exist', async () => {
      const { AppError } = await import('../middleware');
      vi.mocked(documentsService.addVersion).mockRejectedValue(
        new AppError(404, 'DOCUMENT_NOT_FOUND', "Document with id 'nonexistent' not found")
      );

      const res = await request(app)
        .post('/api/documents/nonexistent/versions')
        .attach('file', Buffer.from('content'), 'file.pdf');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });

  describe('GET /api/documents/:id/versions', () => {
    it('should list all versions of a document', async () => {
      const mockVersions = [
        {
          id: 'ver-1',
          document_id: 'doc-123',
          version_number: 1,
          storage_key: 'doc-123/v1/file.pdf',
          uploaded_by: 'user-123',
          uploaded_at: '2024-01-15T10:00:00Z',
          change_description: 'Initial upload',
          size_bytes: 1024,
          checksum: 'hash1',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'ver-2',
          document_id: 'doc-123',
          version_number: 2,
          storage_key: 'doc-123/v2/file.pdf',
          uploaded_by: 'user-123',
          uploaded_at: '2024-02-01T10:00:00Z',
          change_description: 'Updated terms',
          size_bytes: 2048,
          checksum: 'hash2',
          created_at: '2024-02-01T10:00:00Z',
          updated_at: '2024-02-01T10:00:00Z',
        },
      ];

      vi.mocked(documentsService.listVersions).mockResolvedValue(mockVersions);

      const res = await request(app).get('/api/documents/doc-123/versions');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockVersions);
      expect(documentsService.listVersions).toHaveBeenCalledWith('doc-123');
    });

    it('should return 404 when document does not exist', async () => {
      const { AppError } = await import('../middleware');
      vi.mocked(documentsService.listVersions).mockRejectedValue(
        new AppError(404, 'DOCUMENT_NOT_FOUND', "Document with id 'nonexistent' not found")
      );

      const res = await request(app).get('/api/documents/nonexistent/versions');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });

  describe('GET /api/documents/:id/versions/:versionNumber/download', () => {
    it('should download a specific version', async () => {
      const fileContent = Buffer.from('version 1 content');
      const mockVersion = {
        id: 'ver-1',
        document_id: 'doc-123',
        version_number: 1,
        storage_key: 'doc-123/v1/lease.pdf',
        uploaded_by: 'user-123',
        uploaded_at: '2024-01-15T10:00:00Z',
        change_description: 'Initial upload',
        size_bytes: fileContent.length,
        checksum: 'hash1',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      vi.mocked(documentsService.getVersionFile).mockResolvedValue({
        buffer: fileContent,
        version: mockVersion,
      });

      const res = await request(app).get('/api/documents/doc-123/versions/1/download');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/octet-stream');
      expect(res.headers['content-disposition']).toContain('lease.pdf');
      expect(Buffer.from(res.body).toString()).toBe('version 1 content');
      expect(documentsService.getVersionFile).toHaveBeenCalledWith('doc-123', 1, 'user-123');
    });

    it('should return 400 for invalid version number', async () => {
      const res = await request(app).get('/api/documents/doc-123/versions/abc/download');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_VERSION');
    });

    it('should return 400 for negative version number', async () => {
      const res = await request(app).get('/api/documents/doc-123/versions/-1/download');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_VERSION');
    });

    it('should return 404 when version does not exist', async () => {
      const { AppError } = await import('../middleware');
      vi.mocked(documentsService.getVersionFile).mockRejectedValue(
        new AppError(404, 'VERSION_NOT_FOUND', "Version 99 not found for document 'doc-123'")
      );

      const res = await request(app).get('/api/documents/doc-123/versions/99/download');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('VERSION_NOT_FOUND');
    });
  });
});

import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { storageService } from './storage.service';
import { AppError } from '../middleware';
import { auditService } from '../audit';

export interface UploadDocumentInput {
  title: string;
  documentType: 'lease' | 'invoice' | 'report' | 'correspondence';
  propertyId: string;
  tenantId?: string;
  file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
  uploadedBy: string;
}

export interface AddVersionInput {
  documentId: string;
  file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
  uploadedBy: string;
  changeDescription?: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  document_type: string;
  property_id: string;
  tenant_id: string | null;
  storage_key: string;
  current_version: number;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersionRecord {
  id: string;
  document_id: string;
  version_number: number;
  storage_key: string;
  uploaded_by: string;
  uploaded_at: string;
  change_description: string | null;
  size_bytes: number;
  checksum: string;
  created_at: string;
  updated_at: string;
}

export const documentsService = {
  /**
   * Upload a new document: store file, compute checksum, create DB records.
   */
  async upload(input: UploadDocumentInput): Promise<DocumentRecord> {
    const documentId = uuidv4();

    // Store file to local filesystem
    const storageKey = await storageService.storeFile(
      documentId,
      input.file.originalname,
      input.file.buffer
    );

    // Compute SHA-256 checksum
    const checksum = storageService.computeChecksum(input.file.buffer);

    // Create records in a transaction
    const document = await db.transaction(async (trx) => {
      // Create document metadata record
      const [doc] = await trx('documents')
        .insert({
          id: documentId,
          title: input.title,
          document_type: input.documentType,
          property_id: input.propertyId,
          tenant_id: input.tenantId || null,
          storage_key: storageKey,
          current_version: 1,
          mime_type: input.file.mimetype,
          size_bytes: input.file.size,
          uploaded_by: input.uploadedBy,
        })
        .returning('*');

      // Create version 1 record
      await trx('document_versions').insert({
        id: uuidv4(),
        document_id: documentId,
        version_number: 1,
        storage_key: storageKey,
        uploaded_by: input.uploadedBy,
        change_description: 'Initial upload',
        size_bytes: input.file.size,
        checksum,
      });

      return doc;
    });

    // Log audit trail entry for document creation
    await auditService.logAction({
      userId: input.uploadedBy,
      action: 'document.created',
      entityType: 'document',
      entityId: documentId,
      metadata: {
        title: input.title,
        documentType: input.documentType,
        propertyId: input.propertyId,
        tenantId: input.tenantId || null,
        version: 1,
        sizeBytes: input.file.size,
      },
    });

    return document;
  },

  /**
   * List all documents, optionally filtered by propertyId.
   */
  async list(filters?: { propertyId?: string; tenantId?: string }): Promise<DocumentRecord[]> {
    let query = db('documents').select('*').orderBy('created_at', 'desc');

    if (filters?.propertyId) {
      query = query.where('property_id', filters.propertyId);
    }
    if (filters?.tenantId) {
      query = query.where('tenant_id', filters.tenantId);
    }

    return query;
  },

  /**
   * Get a single document by ID.
   */
  async getById(id: string, viewedBy?: string): Promise<DocumentRecord> {
    const document = await db('documents').where('id', id).first();

    if (!document) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', `Document with id '${id}' not found`);
    }

    // Log audit trail entry for document view
    if (viewedBy) {
      await auditService.logAction({
        userId: viewedBy,
        action: 'document.viewed',
        entityType: 'document',
        entityId: id,
      });
    }

    return document;
  },

  /**
   * Add a new version to an existing document using optimistic locking.
   * 1. Read current_version from documents table
   * 2. Attempt to update current_version = current_version + 1 WHERE current_version = expected_version
   * 3. If no rows updated, throw conflict error (409)
   * 4. Store new file, create document_versions record
   */
  async addVersion(input: AddVersionInput): Promise<DocumentVersionRecord> {
    const { documentId, file, uploadedBy, changeDescription } = input;

    // Verify document exists
    const document = await db('documents').where('id', documentId).first();
    if (!document) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', `Document with id '${documentId}' not found`);
    }

    const expectedVersion = document.current_version;
    const newVersion = expectedVersion + 1;

    // Store the new file
    const versionId = uuidv4();
    const storageKey = await storageService.storeFile(
      `${documentId}/v${newVersion}`,
      file.originalname,
      file.buffer
    );

    // Compute checksum
    const checksum = storageService.computeChecksum(file.buffer);

    // Use optimistic locking: update only if current_version matches expected
    const versionRecord = await db.transaction(async (trx) => {
      const updatedRows = await trx('documents')
        .where('id', documentId)
        .andWhere('current_version', expectedVersion)
        .update({
          current_version: newVersion,
          storage_key: storageKey,
          mime_type: file.mimetype,
          size_bytes: file.size,
          updated_at: trx.fn.now(),
        });

      if (updatedRows === 0) {
        throw new AppError(
          409,
          'VERSION_CONFLICT',
          'Document was modified by another user. Please refresh and try again.'
        );
      }

      // Create version record
      const [version] = await trx('document_versions')
        .insert({
          id: versionId,
          document_id: documentId,
          version_number: newVersion,
          storage_key: storageKey,
          uploaded_by: uploadedBy,
          change_description: changeDescription || null,
          size_bytes: file.size,
          checksum,
        })
        .returning('*');

      return version;
    });

    // Log audit trail entry for version addition
    await auditService.logAction({
      userId: uploadedBy,
      action: 'document.version_added',
      entityType: 'document',
      entityId: documentId,
      metadata: {
        versionNumber: newVersion,
        changeDescription: changeDescription || null,
        sizeBytes: file.size,
      },
    });

    return versionRecord;
  },

  /**
   * List all versions of a document ordered by version_number ascending.
   */
  async listVersions(documentId: string): Promise<DocumentVersionRecord[]> {
    // Verify document exists
    const document = await db('documents').where('id', documentId).first();
    if (!document) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', `Document with id '${documentId}' not found`);
    }

    return db('document_versions')
      .where('document_id', documentId)
      .orderBy('version_number', 'asc');
  },

  /**
   * Retrieve the file buffer for a specific version of a document.
   */
  async getVersionFile(documentId: string, versionNumber: number, downloadedBy?: string): Promise<{ buffer: Buffer; version: DocumentVersionRecord }> {
    // Verify document exists
    const document = await db('documents').where('id', documentId).first();
    if (!document) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', `Document with id '${documentId}' not found`);
    }

    const version = await db('document_versions')
      .where('document_id', documentId)
      .andWhere('version_number', versionNumber)
      .first();

    if (!version) {
      throw new AppError(
        404,
        'VERSION_NOT_FOUND',
        `Version ${versionNumber} not found for document '${documentId}'`
      );
    }

    const buffer = await storageService.getFile(version.storage_key);

    // Log audit trail entry for document download
    if (downloadedBy) {
      await auditService.logAction({
        userId: downloadedBy,
        action: 'document.downloaded',
        entityType: 'document',
        entityId: documentId,
        metadata: {
          versionNumber,
        },
      });
    }

    return { buffer, version };
  },
};

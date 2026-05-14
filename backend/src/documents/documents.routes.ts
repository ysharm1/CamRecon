import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../auth';
import { AppError } from '../middleware';
import { documentsService, DocumentRecord, DocumentVersionRecord } from './documents.service';

const router = Router();

/**
 * Convert a snake_case DocumentRecord from the DB into the camelCase shape the frontend expects.
 */
function toDocumentApi(doc: DocumentRecord) {
  return {
    id: doc.id,
    title: doc.title,
    documentType: doc.document_type,
    propertyId: doc.property_id,
    tenantId: doc.tenant_id,
    storageKey: doc.storage_key,
    currentVersion: doc.current_version,
    mimeType: doc.mime_type,
    sizeBytes: Number(doc.size_bytes),
    uploadedBy: doc.uploaded_by,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

/**
 * Convert a snake_case DocumentVersionRecord into the camelCase shape the frontend expects.
 */
function toVersionApi(version: DocumentVersionRecord) {
  return {
    id: version.id,
    documentId: version.document_id,
    versionNumber: version.version_number,
    storageKey: version.storage_key,
    uploadedBy: version.uploaded_by,
    uploadedAt: version.uploaded_at,
    fileName: version.storage_key.split('/').pop() || 'file',
    changeDescription: version.change_description,
    sizeBytes: Number(version.size_bytes),
    checksum: version.checksum,
    mimeType: 'application/octet-stream',
    createdAt: version.created_at,
    updatedAt: version.updated_at,
  };
}

// Configure multer for memory storage with 100MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

/**
 * POST /api/documents
 * Upload a new document.
 */
router.post(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              413,
              'FILE_TOO_LARGE',
              'File size exceeds the maximum allowed size of 100MB'
            )
          );
        }
        return next(new AppError(400, 'UPLOAD_ERROR', err.message));
      }
      if (err) {
        return next(err);
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        throw new AppError(400, 'MISSING_FILE', 'A file must be provided in the "file" field');
      }

      const { title, documentType, propertyId, tenantId } = req.body;

      if (!title) {
        throw new AppError(400, 'VALIDATION_ERROR', 'title is required');
      }
      if (!documentType) {
        throw new AppError(400, 'VALIDATION_ERROR', 'documentType is required');
      }
      if (!propertyId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'propertyId is required');
      }

      const validTypes = ['lease', 'invoice', 'report', 'correspondence'];
      if (!validTypes.includes(documentType)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `documentType must be one of: ${validTypes.join(', ')}`
        );
      }

      const document = await documentsService.upload({
        title,
        documentType,
        propertyId,
        tenantId,
        file: {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        },
        uploadedBy: req.user!.userId,
      });

      res.status(201).json({ data: toDocumentApi(document) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/documents
 * List all documents with optional filters.
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, tenantId } = req.query;

    const documents = await documentsService.list({
      propertyId: propertyId as string | undefined,
      tenantId: tenantId as string | undefined,
    });

    res.json({ data: documents.map(toDocumentApi) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id
 * Get a single document by ID.
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await documentsService.getById(req.params.id, req.user!.userId);
    res.json({ data: toDocumentApi(document) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/documents/:id/versions
 * Upload a new version of an existing document.
 */
router.post(
  '/:id/versions',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              413,
              'FILE_TOO_LARGE',
              'File size exceeds the maximum allowed size of 100MB'
            )
          );
        }
        return next(new AppError(400, 'UPLOAD_ERROR', err.message));
      }
      if (err) {
        return next(err);
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        throw new AppError(400, 'MISSING_FILE', 'A file must be provided in the "file" field');
      }

      const { changeDescription } = req.body;

      const version = await documentsService.addVersion({
        documentId: req.params.id,
        file: {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        },
        uploadedBy: req.user!.userId,
        changeDescription,
      });

      res.status(201).json({ data: toVersionApi(version) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/documents/:id/versions
 * List all versions of a document.
 */
router.get('/:id/versions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await documentsService.listVersions(req.params.id);
    res.json({ data: versions.map(toVersionApi) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id/versions/:versionNumber/download
 * Download a specific version of a document.
 */
router.get(
  '/:id/versions/:versionNumber/download',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versionNumber = parseInt(req.params.versionNumber, 10);
      if (isNaN(versionNumber) || versionNumber < 1) {
        throw new AppError(400, 'INVALID_VERSION', 'Version number must be a positive integer');
      }

      const { buffer, version } = await documentsService.getVersionFile(
        req.params.id,
        versionNumber,
        req.user!.userId
      );

      // Extract filename from storage key
      const filename = version.storage_key.split('/').pop() || 'download';

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length.toString());
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

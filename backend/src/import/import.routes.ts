/**
 * Import Routes
 *
 * POST /api/import/upload — Upload and parse a CSV/Excel file
 * POST /api/import/validate — Validate parsed rows against an import type schema
 * POST /api/import/execute — Execute the import (create records in bulk)
 * POST /api/import/parse-yardi — Parse a Yardi export file
 * POST /api/import/parse-mri — Parse an MRI export file
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import {
  parseFile,
  validateImport,
  executeImport,
  ImportType,
  ParsedRow,
} from './import.service';
import { parseYardiExport } from './parsers/yardi.parser';
import { parseMriExport } from './parsers/mri.parser';

const router = Router();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

const VALID_IMPORT_TYPES: ImportType[] = ['properties', 'tenants', 'lease_terms', 'expenses'];

/**
 * POST /api/import/upload
 * Accepts a file upload, parses it, and returns the parsed rows + column headers.
 */
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'A file must be uploaded');
      }

      const { rows, columns } = await parseFile(req.file.buffer, req.file.mimetype);

      res.json({
        data: {
          rows,
          columns,
          totalRows: rows.length,
          fileName: req.file.originalname,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/import/validate
 * Accepts { rows, importType } and returns validation results.
 */
router.post('/validate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const { rows, importType } = req.body as { rows: ParsedRow[]; importType: string };

    if (!rows || !Array.isArray(rows)) {
      throw new AppError(400, 'INVALID_INPUT', 'rows must be an array');
    }

    if (!importType || !VALID_IMPORT_TYPES.includes(importType as ImportType)) {
      throw new AppError(400, 'INVALID_IMPORT_TYPE', `importType must be one of: ${VALID_IMPORT_TYPES.join(', ')}`);
    }

    const result = validateImport(rows, importType as ImportType);

    res.json({
      data: {
        validCount: result.valid.length,
        errorCount: result.errors.length,
        valid: result.valid,
        errors: result.errors,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/import/execute
 * Accepts { rows, importType } and creates records in bulk.
 */
router.post('/execute', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
    }

    const { rows, importType } = req.body as { rows: ParsedRow[]; importType: string };

    if (!rows || !Array.isArray(rows)) {
      throw new AppError(400, 'INVALID_INPUT', 'rows must be an array');
    }

    if (!VALID_IMPORT_TYPES.includes(importType as ImportType)) {
      throw new AppError(400, 'INVALID_IMPORT_TYPE', `importType must be one of: ${VALID_IMPORT_TYPES.join(', ')}`);
    }

    const result = await executeImport(rows, importType as ImportType, req.user.organizationId);

    res.json({
      data: {
        imported: result.imported,
        errors: result.errors,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/import/parse-yardi
 * Accepts a Yardi export file and returns mapped rows.
 */
router.post(
  '/parse-yardi',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'A file must be uploaded');
      }

      const result = await parseYardiExport(req.file.buffer, req.file.mimetype);

      res.json({
        data: {
          rows: result.rows,
          importType: result.importType,
          totalRows: result.rows.length,
          mappedColumns: result.mappedColumns,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/import/parse-mri
 * Accepts an MRI export file and returns mapped rows.
 */
router.post(
  '/parse-mri',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required');
      }

      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'A file must be uploaded');
      }

      const result = await parseMriExport(req.file.buffer, req.file.mimetype);

      res.json({
        data: {
          rows: result.rows,
          importType: result.importType,
          totalRows: result.rows.length,
          mappedColumns: result.mappedColumns,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

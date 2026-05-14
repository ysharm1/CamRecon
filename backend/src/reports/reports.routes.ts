/**
 * Report Generation Routes
 *
 * GET /api/reports/tenant-statement?tenantId=&periodStart=&periodEnd=&format=pdf|excel
 * GET /api/reports/variance?reconciliationId=&format=pdf|excel
 * GET /api/reports/reconciliation-package?reconciliationId=&format=pdf|excel
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../auth';
import { AppError } from '../middleware/errorHandler';
import {
  getTenantStatementData,
  getVarianceReportData,
  getReconciliationPackageData,
} from './reports.service';
import {
  generateTenantStatementPDF,
  generateVarianceReportPDF,
  generateReconciliationPackagePDF,
} from './pdf-generator';
import {
  generateTenantStatementExcel,
  generateVarianceReportExcel,
  generateReconciliationPackageExcel,
} from './excel-generator';

const router = Router();

type ReportFormat = 'pdf' | 'excel';

/** Validate and extract the format query parameter */
function getFormat(format: unknown): ReportFormat {
  if (format === 'excel') return 'excel';
  if (format === 'pdf' || !format) return 'pdf'; // Default to PDF
  throw new AppError(400, 'VALIDATION_ERROR', 'format must be "pdf" or "excel"');
}

/**
 * GET /api/reports/tenant-statement
 * Generate a tenant statement report.
 *
 * Query params:
 *   - tenantId (required)
 *   - periodStart (required, YYYY-MM-DD)
 *   - periodEnd (required, YYYY-MM-DD)
 *   - format (optional, "pdf" or "excel", defaults to "pdf")
 */
router.get(
  '/tenant-statement',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, periodStart, periodEnd, format } = req.query;

      // Validate required params
      if (!tenantId || typeof tenantId !== 'string') {
        throw new AppError(400, 'VALIDATION_ERROR', 'tenantId query parameter is required');
      }
      if (!periodStart || typeof periodStart !== 'string') {
        throw new AppError(400, 'VALIDATION_ERROR', 'periodStart query parameter is required');
      }
      if (!periodEnd || typeof periodEnd !== 'string') {
        throw new AppError(400, 'VALIDATION_ERROR', 'periodEnd query parameter is required');
      }

      // Validate dates
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      if (isNaN(startDate.getTime())) {
        throw new AppError(400, 'VALIDATION_ERROR', 'periodStart must be a valid date');
      }
      if (isNaN(endDate.getTime())) {
        throw new AppError(400, 'VALIDATION_ERROR', 'periodEnd must be a valid date');
      }
      if (endDate <= startDate) {
        throw new AppError(400, 'VALIDATION_ERROR', 'periodEnd must be after periodStart');
      }

      const reportFormat = getFormat(format);
      const data = await getTenantStatementData(tenantId, periodStart, periodEnd);

      if (reportFormat === 'pdf') {
        const filename = `tenant-statement-${tenantId}-${periodStart}-${periodEnd}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const pdfDoc = generateTenantStatementPDF(data);
        pdfDoc.pipe(res);
      } else {
        const filename = `tenant-statement-${tenantId}-${periodStart}-${periodEnd}.xlsx`;
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const workbook = await generateTenantStatementExcel(data);
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/variance
 * Generate a variance report.
 *
 * Query params:
 *   - reconciliationId (required)
 *   - format (optional, "pdf" or "excel", defaults to "pdf")
 */
router.get(
  '/variance',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reconciliationId, format } = req.query;

      if (!reconciliationId || typeof reconciliationId !== 'string') {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'reconciliationId query parameter is required'
        );
      }

      const reportFormat = getFormat(format);
      const data = await getVarianceReportData(reconciliationId);

      if (reportFormat === 'pdf') {
        const filename = `variance-report-${reconciliationId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const pdfDoc = generateVarianceReportPDF(data);
        pdfDoc.pipe(res);
      } else {
        const filename = `variance-report-${reconciliationId}.xlsx`;
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const workbook = await generateVarianceReportExcel(data);
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/reconciliation-package
 * Generate a reconciliation package report.
 *
 * Query params:
 *   - reconciliationId (required)
 *   - format (optional, "pdf" or "excel", defaults to "pdf")
 */
router.get(
  '/reconciliation-package',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reconciliationId, format } = req.query;

      if (!reconciliationId || typeof reconciliationId !== 'string') {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'reconciliationId query parameter is required'
        );
      }

      const reportFormat = getFormat(format);
      const data = await getReconciliationPackageData(reconciliationId);

      if (reportFormat === 'pdf') {
        const filename = `reconciliation-package-${reconciliationId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const pdfDoc = generateReconciliationPackagePDF(data);
        pdfDoc.pipe(res);
      } else {
        const filename = `reconciliation-package-${reconciliationId}.xlsx`;
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const workbook = await generateReconciliationPackageExcel(data);
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;

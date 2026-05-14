/**
 * PDF Report Generator
 *
 * Generates professional PDF reports using PDFKit.
 * Supports tenant statements, variance reports, and reconciliation packages.
 */

import PDFDocument from 'pdfkit';
import type {
  TenantStatementData,
  VarianceReportData,
  ReconciliationPackageData,
} from './reports.service';

/** Format cents to dollar string */
function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

/** Format percentage */
function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** Add a header section to the PDF */
function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .text(title, { align: 'center' });

  if (subtitle) {
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(subtitle, { align: 'center' });
  }

  doc.moveDown(1);
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .stroke();
  doc.moveDown(0.5);
}

/** Add property info section */
function addPropertyInfo(
  doc: PDFKit.PDFDocument,
  property: { name: string; address: Record<string, unknown> }
): void {
  doc.fontSize(11).font('Helvetica-Bold').text('Property:');
  doc.fontSize(10).font('Helvetica').text(property.name);
  if (property.address) {
    const addr = property.address;
    const addressStr = [addr.street, addr.city, addr.state, addr.zip]
      .filter(Boolean)
      .join(', ');
    if (addressStr) {
      doc.text(addressStr);
    }
  }
  doc.moveDown(0.5);
}

/** Draw a simple table */
function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  columnWidths: number[]
): void {
  const startX = 50;
  const startY = doc.y;
  const rowHeight = 20;
  const tableWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  // Draw header background
  doc
    .rect(startX, startY, tableWidth, rowHeight)
    .fill('#f0f0f0');

  // Draw header text
  doc.fill('#000000').fontSize(9).font('Helvetica-Bold');
  let x = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 4, startY + 5, {
      width: columnWidths[i] - 8,
      align: i === 0 ? 'left' : 'right',
    });
    x += columnWidths[i];
  }

  // Draw rows
  doc.font('Helvetica').fontSize(9);
  let y = startY + rowHeight;

  for (const row of rows) {
    // Check if we need a new page
    if (y + rowHeight > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }

    x = startX;
    for (let i = 0; i < row.length; i++) {
      doc.fill('#000000').text(row[i], x + 4, y + 5, {
        width: columnWidths[i] - 8,
        align: i === 0 ? 'left' : 'right',
      });
      x += columnWidths[i];
    }

    // Draw row border
    doc
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + tableWidth, y + rowHeight)
      .stroke('#cccccc');

    y += rowHeight;
  }

  doc.y = y + 10;
  doc.x = startX;
}

/**
 * Generate a tenant statement PDF.
 */
export function generateTenantStatementPDF(data: TenantStatementData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Header
  addHeader(
    doc,
    'Tenant Statement',
    `Period: ${data.periodStart} to ${data.periodEnd}`
  );

  // Property info
  addPropertyInfo(doc, data.property);

  // Tenant info
  doc.fontSize(11).font('Helvetica-Bold').text('Tenant:');
  doc.fontSize(10).font('Helvetica');
  doc.text(`Name: ${data.tenant.name}`);
  doc.text(`Suite: ${data.tenant.suiteNumber}`);
  doc.text(`Square Footage: ${data.tenant.squareFootage.toLocaleString()} sq ft`);
  doc.text(`Contact: ${data.tenant.contactEmail}`);
  doc.moveDown(1);

  // Charge breakdown table
  doc.fontSize(12).font('Helvetica-Bold').text('Charge Breakdown');
  doc.moveDown(0.5);

  if (data.allocations.length > 0) {
    const headers = ['Period', 'Share %', 'Estimated', 'Actual', 'Variance'];
    const columnWidths = [120, 80, 100, 100, 100];

    const rows = data.allocations.map((alloc) => [
      `${alloc.periodStart} - ${alloc.periodEnd}`,
      formatPercentage(alloc.sharePercentage),
      formatCurrency(alloc.estimatedAmountCents),
      formatCurrency(alloc.actualAmountCents),
      formatCurrency(alloc.varianceCents),
    ]);

    // Add totals row
    rows.push([
      'TOTAL',
      '',
      formatCurrency(data.totalEstimatedCents),
      formatCurrency(data.totalActualCents),
      formatCurrency(data.totalVarianceCents),
    ]);

    drawTable(doc, headers, rows, columnWidths);
  } else {
    doc.fontSize(10).font('Helvetica').text('No charges found for this period.');
  }

  // Line item detail for each allocation
  if (data.allocations.length > 0) {
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text('Expense Detail');
    doc.moveDown(0.5);

    for (const alloc of data.allocations) {
      if (alloc.lineItems.length > 0) {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`Period: ${alloc.periodStart} - ${alloc.periodEnd}`);
        doc.moveDown(0.3);

        const headers = ['Category', 'Description', 'Amount'];
        const columnWidths = [120, 250, 130];
        const rows = alloc.lineItems.map((li) => [
          li.category,
          li.description,
          formatCurrency(li.amountCents),
        ]);

        drawTable(doc, headers, rows, columnWidths);
        doc.moveDown(0.5);
      }
    }
  }

  // Footer
  doc.moveDown(1);
  doc
    .fontSize(8)
    .font('Helvetica')
    .text(`Generated: ${new Date().toISOString()}`, { align: 'right' });

  doc.end();
  return doc;
}

/**
 * Generate a variance report PDF.
 */
export function generateVarianceReportPDF(data: VarianceReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });

  // Header
  addHeader(
    doc,
    'CAM Variance Report',
    `Period: ${data.reconciliation.periodStart} to ${data.reconciliation.periodEnd}`
  );

  // Property info
  addPropertyInfo(doc, data.property);

  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Expenses: ${formatCurrency(data.reconciliation.totalExpensesCents)}`);
  doc.text(`Total Leasable Area: ${data.property.totalSquareFootage.toLocaleString()} sq ft`);
  doc.text(`Status: ${data.reconciliation.status}`);
  doc.moveDown(1);

  // Allocation comparison table
  doc.fontSize(12).font('Helvetica-Bold').text('Tenant Allocations - Estimated vs Actual');
  doc.moveDown(0.5);

  const headers = ['Tenant', 'Suite', 'Sq Ft', 'Share %', 'Estimated', 'Actual', 'Variance'];
  const columnWidths = [140, 60, 70, 70, 100, 100, 100];

  const rows = data.allocations.map((alloc) => [
    alloc.tenantName,
    alloc.suiteNumber,
    alloc.squareFootage.toLocaleString(),
    formatPercentage(alloc.sharePercentage),
    formatCurrency(alloc.estimatedAmountCents),
    formatCurrency(alloc.actualAmountCents),
    formatCurrency(alloc.varianceCents),
  ]);

  // Add totals row
  rows.push([
    'TOTAL',
    '',
    '',
    '',
    formatCurrency(data.totalEstimatedCents),
    formatCurrency(data.totalActualCents),
    formatCurrency(data.totalVarianceCents),
  ]);

  drawTable(doc, headers, rows, columnWidths);

  // Expense line items
  doc.moveDown(1);
  doc.fontSize(12).font('Helvetica-Bold').text('Expense Line Items');
  doc.moveDown(0.5);

  const liHeaders = ['Category', 'Description', 'Amount'];
  const liColumnWidths = [150, 350, 140];
  const liRows = data.lineItems.map((li) => [
    li.category,
    li.description,
    formatCurrency(li.amountCents),
  ]);

  drawTable(doc, liHeaders, liRows, liColumnWidths);

  // Footer
  doc.moveDown(1);
  doc
    .fontSize(8)
    .font('Helvetica')
    .text(`Generated: ${new Date().toISOString()}`, { align: 'right' });

  doc.end();
  return doc;
}

/**
 * Generate a reconciliation package PDF.
 */
export function generateReconciliationPackagePDF(
  data: ReconciliationPackageData
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Title page
  addHeader(
    doc,
    'CAM Reconciliation Package',
    `Period: ${data.reconciliation.periodStart} to ${data.reconciliation.periodEnd}`
  );

  addPropertyInfo(doc, data.property);

  doc.fontSize(10).font('Helvetica');
  doc.text(`Reconciliation ID: ${data.reconciliation.id}`);
  doc.text(`Status: ${data.reconciliation.status}`);
  doc.text(`Total Expenses: ${formatCurrency(data.reconciliation.totalExpensesCents)}`);
  doc.text(`Generated: ${data.generatedAt}`);
  doc.moveDown(2);

  // Section 1: Expense Summary
  doc.fontSize(14).font('Helvetica-Bold').text('1. Expense Summary');
  doc.moveDown(0.5);

  const summaryHeaders = ['Category', 'Total Amount'];
  const summaryWidths = [250, 250];
  const summaryRows = data.expenseSummary.map((s) => [
    s.category,
    formatCurrency(s.totalCents),
  ]);
  summaryRows.push(['TOTAL', formatCurrency(data.reconciliation.totalExpensesCents)]);

  drawTable(doc, summaryHeaders, summaryRows, summaryWidths);

  // Section 2: Detailed Line Items
  doc.moveDown(1);
  doc.fontSize(14).font('Helvetica-Bold').text('2. Detailed Expense Line Items');
  doc.moveDown(0.5);

  const liHeaders = ['Category', 'Description', 'Amount'];
  const liWidths = [130, 250, 120];
  const liRows = data.lineItems.map((li) => [
    li.category,
    li.description,
    formatCurrency(li.amountCents),
  ]);

  drawTable(doc, liHeaders, liRows, liWidths);

  // Section 3: Tenant Allocations
  doc.addPage();
  doc.fontSize(14).font('Helvetica-Bold').text('3. Tenant Allocations');
  doc.moveDown(0.5);

  const allocHeaders = ['Tenant', 'Suite', 'Share %', 'Estimated', 'Actual', 'Variance'];
  const allocWidths = [120, 60, 70, 80, 80, 80];
  const allocRows = data.allocations.map((a) => [
    a.tenantName,
    a.suiteNumber,
    formatPercentage(a.sharePercentage),
    formatCurrency(a.estimatedAmountCents),
    formatCurrency(a.actualAmountCents),
    formatCurrency(a.varianceCents),
  ]);
  allocRows.push([
    'TOTAL',
    '',
    '',
    formatCurrency(data.totalEstimatedCents),
    formatCurrency(data.totalActualCents),
    formatCurrency(data.totalVarianceCents),
  ]);

  drawTable(doc, allocHeaders, allocRows, allocWidths);

  // Section 4: Variance Analysis
  doc.moveDown(1);
  doc.fontSize(14).font('Helvetica-Bold').text('4. Variance Analysis');
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Estimated CAM Charges: ${formatCurrency(data.totalEstimatedCents)}`);
  doc.text(`Total Actual CAM Charges: ${formatCurrency(data.totalActualCents)}`);
  doc.text(`Net Variance: ${formatCurrency(data.totalVarianceCents)}`);
  doc.moveDown(0.5);

  if (data.totalVarianceCents > 0) {
    doc.text('Note: Positive variance indicates actual charges exceeded estimates.');
  } else if (data.totalVarianceCents < 0) {
    doc.text('Note: Negative variance indicates actual charges were below estimates.');
  } else {
    doc.text('Note: Actual charges matched estimates exactly.');
  }

  // Footer
  doc.moveDown(2);
  doc
    .fontSize(8)
    .font('Helvetica')
    .text(
      'This document is generated for audit purposes. ' +
        'All figures are based on reconciliation data as of the generation date.',
      { align: 'center' }
    );

  doc.end();
  return doc;
}

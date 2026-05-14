/**
 * Owner Report PDF Generator
 *
 * Generates branded PDF reports for property owners/investors.
 * Includes: occupancy rates, revenue summary, CAM recovery rates,
 * lease expiration timeline, and tenant roster.
 */

import PDFDocument from 'pdfkit';
import type { OwnerReportData } from './owner-portal.service';

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
  return `${(value * 100).toFixed(1)}%`;
}

/** Parse hex color to RGB */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }
  return [79, 70, 229]; // Default indigo
}

/** Add branded header to the PDF */
function addBrandedHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  organization: OwnerReportData['organization']
): void {
  const [r, g, b] = hexToRgb(organization.primaryColor);

  // Header bar
  doc.rect(0, 0, doc.page.width, 80).fill(organization.primaryColor);

  // Organization name or report header
  const headerText = organization.reportHeader || organization.name;
  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .fillColor('white')
    .text(headerText, 50, 20, { align: 'left' });

  // Report title
  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor('white')
    .text(title, 50, 50, { align: 'left' });

  doc.y = 100;
  doc.fillColor('#000000');
}

/** Draw a section header */
function addSectionHeader(doc: PDFKit.PDFDocument, title: string, primaryColor: string): void {
  doc.moveDown(0.5);
  const [r, g, b] = hexToRgb(primaryColor);
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text(title);
  doc.fillColor('#000000');
  doc.moveDown(0.3);

  // Underline
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor(primaryColor)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.5);
}

/** Draw a simple table */
function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  columnWidths: number[],
  primaryColor: string
): void {
  const startX = 50;
  const startY = doc.y;
  const rowHeight = 20;
  const tableWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  // Draw header background
  doc.rect(startX, startY, tableWidth, rowHeight).fill(primaryColor);

  // Draw header text
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
  let x = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 4, startY + 5, {
      width: columnWidths[i] - 8,
      align: i === 0 ? 'left' : 'right',
    });
    x += columnWidths[i];
  }

  // Draw rows
  doc.fillColor('#000000').font('Helvetica').fontSize(9);
  let y = startY + rowHeight;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];

    // Check if we need a new page
    if (y + rowHeight > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }

    // Alternate row background
    if (rowIdx % 2 === 0) {
      doc.rect(startX, y, tableWidth, rowHeight).fill('#f9fafb');
      doc.fillColor('#000000');
    }

    x = startX;
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i], x + 4, y + 5, {
        width: columnWidths[i] - 8,
        align: i === 0 ? 'left' : 'right',
      });
      x += columnWidths[i];
    }

    // Draw row border
    doc
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + tableWidth, y + rowHeight)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke();

    y += rowHeight;
  }

  doc.y = y + 10;
  doc.x = startX;
}

/** Draw a metric card */
function drawMetricCard(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  primaryColor: string
): void {
  // Card background
  doc.rect(x, y, width, 50).fill('#f8fafc');
  doc.rect(x, y, width, 3).fill(primaryColor);

  // Label
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text(label, x + 10, y + 12, { width: width - 20 });

  // Value
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text(value, x + 10, y + 28, { width: width - 20 });
}

/**
 * Generate a branded owner report PDF.
 */
export function generateOwnerReportPDF(data: OwnerReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const { primaryColor } = data.organization;

  // Branded header
  addBrandedHeader(doc, `Property Report: ${data.property.name}`, data.organization);

  // Property info
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280');
  const addr = data.property.address;
  const addressStr = [
    (addr as Record<string, string>).street,
    (addr as Record<string, string>).city,
    (addr as Record<string, string>).state,
    (addr as Record<string, string>).zip,
  ].filter(Boolean).join(', ');
  if (addressStr) {
    doc.text(addressStr);
  }
  doc.text(`Type: ${data.property.propertyType} | Total Area: ${data.property.totalSquareFootage.toLocaleString()} sq ft`);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  doc.fillColor('#000000');
  doc.moveDown(1);

  // Key Metrics Section
  addSectionHeader(doc, 'Key Metrics', primaryColor);

  const metricsY = doc.y;
  const cardWidth = 120;
  const cardGap = 15;

  drawMetricCard(doc, 'Occupancy Rate', formatPercentage(data.occupancyRate), 50, metricsY, cardWidth, primaryColor);
  drawMetricCard(doc, 'Total Revenue', formatCurrency(data.revenueSummary.totalRevenueCents), 50 + cardWidth + cardGap, metricsY, cardWidth, primaryColor);
  drawMetricCard(doc, 'CAM Recovery', formatPercentage(data.camRecoveryRate), 50 + (cardWidth + cardGap) * 2, metricsY, cardWidth, primaryColor);
  drawMetricCard(doc, 'Active Tenants', `${data.tenantRoster.filter(t => t.status === 'active').length}`, 50 + (cardWidth + cardGap) * 3, metricsY, cardWidth, primaryColor);

  doc.y = metricsY + 70;

  // Revenue Summary
  addSectionHeader(doc, 'Revenue Summary', primaryColor);

  doc.fontSize(10).font('Helvetica');
  doc.text(`Estimated CAM Collected: ${formatCurrency(data.revenueSummary.totalRentCollectedCents)}`);
  doc.text(`Actual CAM Collected: ${formatCurrency(data.revenueSummary.totalCamCollectedCents)}`);
  doc.text(`Total Revenue: ${formatCurrency(data.revenueSummary.totalRevenueCents)}`);
  doc.text(`CAM Recovery Rate: ${formatPercentage(data.camRecoveryRate)}`);
  doc.moveDown(1);

  // Lease Expiration Timeline
  addSectionHeader(doc, 'Lease Expiration Timeline', primaryColor);

  if (data.leaseExpirations.length > 0) {
    const leaseHeaders = ['Tenant', 'Suite', 'Sq Ft', 'Expiration Date'];
    const leaseWidths = [180, 70, 80, 160];
    const leaseRows = data.leaseExpirations.map((le) => [
      le.tenantName,
      le.suiteNumber,
      le.squareFootage.toLocaleString(),
      new Date(le.expirationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    ]);
    drawTable(doc, leaseHeaders, leaseRows, leaseWidths, primaryColor);
  } else {
    doc.fontSize(10).font('Helvetica').text('No lease expiration data available.');
  }

  // Tenant Roster (new page if needed)
  if (doc.y > doc.page.height - 200) {
    doc.addPage();
    addBrandedHeader(doc, `Property Report: ${data.property.name} (continued)`, data.organization);
  }

  addSectionHeader(doc, 'Tenant Roster', primaryColor);

  if (data.tenantRoster.length > 0) {
    const rosterHeaders = ['Tenant', 'Suite', 'Sq Ft', 'Status', 'Contact'];
    const rosterWidths = [140, 60, 70, 70, 150];
    const rosterRows = data.tenantRoster.map((t) => [
      t.name,
      t.suiteNumber,
      t.squareFootage.toLocaleString(),
      t.status,
      t.contactEmail,
    ]);
    drawTable(doc, rosterHeaders, rosterRows, rosterWidths, primaryColor);
  } else {
    doc.fontSize(10).font('Helvetica').text('No tenants found for this property.');
  }

  // Footer
  doc.moveDown(2);
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#9ca3af')
    .text(
      `Confidential — ${data.organization.name} | Generated ${new Date().toISOString()}`,
      { align: 'center' }
    );

  doc.end();
  return doc;
}

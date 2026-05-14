/**
 * Excel Report Generator
 *
 * Generates professional Excel reports using exceljs.
 * Supports tenant statements, variance reports, and reconciliation packages.
 */

import ExcelJS from 'exceljs';
import type {
  TenantStatementData,
  VarianceReportData,
  ReconciliationPackageData,
} from './reports.service';

/** Format cents to dollar value for Excel */
function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Apply header styling to a row */
function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
}

/** Apply currency format to a column */
function setCurrencyFormat(column: Partial<ExcelJS.Column>): void {
  column.numFmt = '$#,##0.00';
}

/** Apply percentage format to a column */
function setPercentageFormat(column: Partial<ExcelJS.Column>): void {
  column.numFmt = '0.00%';
}

/**
 * Generate a tenant statement Excel workbook.
 */
export async function generateTenantStatementExcel(
  data: TenantStatementData
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Property Document Platform';
  workbook.created = new Date();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Statement Summary');

  // Title
  summarySheet.mergeCells('A1:E1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'Tenant Statement';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Period
  summarySheet.mergeCells('A2:E2');
  const periodCell = summarySheet.getCell('A2');
  periodCell.value = `Period: ${data.periodStart} to ${data.periodEnd}`;
  periodCell.alignment = { horizontal: 'center' };

  // Property info
  summarySheet.getCell('A4').value = 'Property:';
  summarySheet.getCell('A4').font = { bold: true };
  summarySheet.getCell('B4').value = data.property.name;

  // Tenant info
  summarySheet.getCell('A5').value = 'Tenant:';
  summarySheet.getCell('A5').font = { bold: true };
  summarySheet.getCell('B5').value = data.tenant.name;

  summarySheet.getCell('A6').value = 'Suite:';
  summarySheet.getCell('A6').font = { bold: true };
  summarySheet.getCell('B6').value = data.tenant.suiteNumber;

  summarySheet.getCell('A7').value = 'Square Footage:';
  summarySheet.getCell('A7').font = { bold: true };
  summarySheet.getCell('B7').value = data.tenant.squareFootage;

  // Charge breakdown table
  const tableStartRow = 9;
  const headerRow = summarySheet.getRow(tableStartRow);
  headerRow.values = ['Period', 'Share %', 'Estimated', 'Actual', 'Variance'];
  styleHeaderRow(headerRow);

  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 12;
  summarySheet.getColumn(3).width = 15;
  summarySheet.getColumn(4).width = 15;
  summarySheet.getColumn(5).width = 15;

  let currentRow = tableStartRow + 1;
  for (const alloc of data.allocations) {
    const row = summarySheet.getRow(currentRow);
    row.values = [
      `${alloc.periodStart} - ${alloc.periodEnd}`,
      alloc.sharePercentage,
      centsToDollars(alloc.estimatedAmountCents),
      centsToDollars(alloc.actualAmountCents),
      centsToDollars(alloc.varianceCents),
    ];
    row.getCell(2).numFmt = '0.00%';
    row.getCell(3).numFmt = '$#,##0.00';
    row.getCell(4).numFmt = '$#,##0.00';
    row.getCell(5).numFmt = '$#,##0.00';
    currentRow++;
  }

  // Totals row
  const totalsRow = summarySheet.getRow(currentRow);
  totalsRow.values = [
    'TOTAL',
    '',
    centsToDollars(data.totalEstimatedCents),
    centsToDollars(data.totalActualCents),
    centsToDollars(data.totalVarianceCents),
  ];
  totalsRow.font = { bold: true };
  totalsRow.getCell(3).numFmt = '$#,##0.00';
  totalsRow.getCell(4).numFmt = '$#,##0.00';
  totalsRow.getCell(5).numFmt = '$#,##0.00';

  // Detail sheet with line items
  if (data.allocations.some((a) => a.lineItems.length > 0)) {
    const detailSheet = workbook.addWorksheet('Expense Detail');

    const detailHeader = detailSheet.getRow(1);
    detailHeader.values = ['Period', 'Category', 'Description', 'Amount'];
    styleHeaderRow(detailHeader);

    detailSheet.getColumn(1).width = 30;
    detailSheet.getColumn(2).width = 20;
    detailSheet.getColumn(3).width = 40;
    detailSheet.getColumn(4).width = 15;

    let detailRow = 2;
    for (const alloc of data.allocations) {
      for (const li of alloc.lineItems) {
        const row = detailSheet.getRow(detailRow);
        row.values = [
          `${alloc.periodStart} - ${alloc.periodEnd}`,
          li.category,
          li.description,
          centsToDollars(li.amountCents),
        ];
        row.getCell(4).numFmt = '$#,##0.00';
        detailRow++;
      }
    }
  }

  return workbook;
}

/**
 * Generate a variance report Excel workbook.
 */
export async function generateVarianceReportExcel(
  data: VarianceReportData
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Property Document Platform';
  workbook.created = new Date();

  // Allocations sheet
  const allocSheet = workbook.addWorksheet('Variance Report');

  // Title
  allocSheet.mergeCells('A1:G1');
  const titleCell = allocSheet.getCell('A1');
  titleCell.value = 'CAM Variance Report';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Info
  allocSheet.mergeCells('A2:G2');
  allocSheet.getCell('A2').value =
    `Period: ${data.reconciliation.periodStart} to ${data.reconciliation.periodEnd}`;
  allocSheet.getCell('A2').alignment = { horizontal: 'center' };

  allocSheet.getCell('A4').value = 'Property:';
  allocSheet.getCell('A4').font = { bold: true };
  allocSheet.getCell('B4').value = data.property.name;

  allocSheet.getCell('A5').value = 'Total Expenses:';
  allocSheet.getCell('A5').font = { bold: true };
  allocSheet.getCell('B5').value = centsToDollars(data.reconciliation.totalExpensesCents);
  allocSheet.getCell('B5').numFmt = '$#,##0.00';

  allocSheet.getCell('A6').value = 'Total Leasable Area:';
  allocSheet.getCell('A6').font = { bold: true };
  allocSheet.getCell('B6').value = `${data.property.totalSquareFootage.toLocaleString()} sq ft`;

  // Allocations table
  const tableStartRow = 8;
  const headerRow = allocSheet.getRow(tableStartRow);
  headerRow.values = ['Tenant', 'Suite', 'Sq Ft', 'Share %', 'Estimated', 'Actual', 'Variance'];
  styleHeaderRow(headerRow);

  allocSheet.getColumn(1).width = 25;
  allocSheet.getColumn(2).width = 10;
  allocSheet.getColumn(3).width = 12;
  allocSheet.getColumn(4).width = 12;
  allocSheet.getColumn(5).width = 15;
  allocSheet.getColumn(6).width = 15;
  allocSheet.getColumn(7).width = 15;

  let currentRow = tableStartRow + 1;
  for (const alloc of data.allocations) {
    const row = allocSheet.getRow(currentRow);
    row.values = [
      alloc.tenantName,
      alloc.suiteNumber,
      alloc.squareFootage,
      alloc.sharePercentage,
      centsToDollars(alloc.estimatedAmountCents),
      centsToDollars(alloc.actualAmountCents),
      centsToDollars(alloc.varianceCents),
    ];
    row.getCell(4).numFmt = '0.00%';
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).numFmt = '$#,##0.00';
    currentRow++;
  }

  // Totals
  const totalsRow = allocSheet.getRow(currentRow);
  totalsRow.values = [
    'TOTAL',
    '',
    '',
    '',
    centsToDollars(data.totalEstimatedCents),
    centsToDollars(data.totalActualCents),
    centsToDollars(data.totalVarianceCents),
  ];
  totalsRow.font = { bold: true };
  totalsRow.getCell(5).numFmt = '$#,##0.00';
  totalsRow.getCell(6).numFmt = '$#,##0.00';
  totalsRow.getCell(7).numFmt = '$#,##0.00';

  // Line items sheet
  const lineItemsSheet = workbook.addWorksheet('Expense Line Items');

  const liHeader = lineItemsSheet.getRow(1);
  liHeader.values = ['Category', 'Description', 'Amount'];
  styleHeaderRow(liHeader);

  lineItemsSheet.getColumn(1).width = 20;
  lineItemsSheet.getColumn(2).width = 50;
  lineItemsSheet.getColumn(3).width = 15;

  let liRow = 2;
  for (const li of data.lineItems) {
    const row = lineItemsSheet.getRow(liRow);
    row.values = [li.category, li.description, centsToDollars(li.amountCents)];
    row.getCell(3).numFmt = '$#,##0.00';
    liRow++;
  }

  return workbook;
}

/**
 * Generate a reconciliation package Excel workbook.
 */
export async function generateReconciliationPackageExcel(
  data: ReconciliationPackageData
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Property Document Platform';
  workbook.created = new Date();

  // Cover sheet
  const coverSheet = workbook.addWorksheet('Cover');
  coverSheet.mergeCells('A1:D1');
  coverSheet.getCell('A1').value = 'CAM Reconciliation Package';
  coverSheet.getCell('A1').font = { size: 18, bold: true };
  coverSheet.getCell('A1').alignment = { horizontal: 'center' };

  coverSheet.getCell('A3').value = 'Property:';
  coverSheet.getCell('A3').font = { bold: true };
  coverSheet.getCell('B3').value = data.property.name;

  coverSheet.getCell('A4').value = 'Period:';
  coverSheet.getCell('A4').font = { bold: true };
  coverSheet.getCell('B4').value =
    `${data.reconciliation.periodStart} to ${data.reconciliation.periodEnd}`;

  coverSheet.getCell('A5').value = 'Status:';
  coverSheet.getCell('A5').font = { bold: true };
  coverSheet.getCell('B5').value = data.reconciliation.status;

  coverSheet.getCell('A6').value = 'Total Expenses:';
  coverSheet.getCell('A6').font = { bold: true };
  coverSheet.getCell('B6').value = centsToDollars(data.reconciliation.totalExpensesCents);
  coverSheet.getCell('B6').numFmt = '$#,##0.00';

  coverSheet.getCell('A7').value = 'Generated:';
  coverSheet.getCell('A7').font = { bold: true };
  coverSheet.getCell('B7').value = data.generatedAt;

  coverSheet.getColumn(1).width = 20;
  coverSheet.getColumn(2).width = 40;

  // Expense Summary sheet
  const summarySheet = workbook.addWorksheet('Expense Summary');
  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.values = ['Category', 'Total Amount'];
  styleHeaderRow(summaryHeader);

  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 20;

  let sRow = 2;
  for (const item of data.expenseSummary) {
    const row = summarySheet.getRow(sRow);
    row.values = [item.category, centsToDollars(item.totalCents)];
    row.getCell(2).numFmt = '$#,##0.00';
    sRow++;
  }
  const sTotalRow = summarySheet.getRow(sRow);
  sTotalRow.values = ['TOTAL', centsToDollars(data.reconciliation.totalExpensesCents)];
  sTotalRow.font = { bold: true };
  sTotalRow.getCell(2).numFmt = '$#,##0.00';

  // Detailed Line Items sheet
  const detailSheet = workbook.addWorksheet('Line Items');
  const detailHeader = detailSheet.getRow(1);
  detailHeader.values = ['Category', 'Description', 'Amount'];
  styleHeaderRow(detailHeader);

  detailSheet.getColumn(1).width = 20;
  detailSheet.getColumn(2).width = 50;
  detailSheet.getColumn(3).width = 15;

  let dRow = 2;
  for (const li of data.lineItems) {
    const row = detailSheet.getRow(dRow);
    row.values = [li.category, li.description, centsToDollars(li.amountCents)];
    row.getCell(3).numFmt = '$#,##0.00';
    dRow++;
  }

  // Allocations sheet
  const allocSheet = workbook.addWorksheet('Tenant Allocations');
  const allocHeader = allocSheet.getRow(1);
  allocHeader.values = ['Tenant', 'Suite', 'Sq Ft', 'Share %', 'Estimated', 'Actual', 'Variance'];
  styleHeaderRow(allocHeader);

  allocSheet.getColumn(1).width = 25;
  allocSheet.getColumn(2).width = 10;
  allocSheet.getColumn(3).width = 12;
  allocSheet.getColumn(4).width = 12;
  allocSheet.getColumn(5).width = 15;
  allocSheet.getColumn(6).width = 15;
  allocSheet.getColumn(7).width = 15;

  let aRow = 2;
  for (const alloc of data.allocations) {
    const row = allocSheet.getRow(aRow);
    row.values = [
      alloc.tenantName,
      alloc.suiteNumber,
      alloc.squareFootage,
      alloc.sharePercentage,
      centsToDollars(alloc.estimatedAmountCents),
      centsToDollars(alloc.actualAmountCents),
      centsToDollars(alloc.varianceCents),
    ];
    row.getCell(4).numFmt = '0.00%';
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).numFmt = '$#,##0.00';
    aRow++;
  }

  const allocTotalRow = allocSheet.getRow(aRow);
  allocTotalRow.values = [
    'TOTAL',
    '',
    '',
    '',
    centsToDollars(data.totalEstimatedCents),
    centsToDollars(data.totalActualCents),
    centsToDollars(data.totalVarianceCents),
  ];
  allocTotalRow.font = { bold: true };
  allocTotalRow.getCell(5).numFmt = '$#,##0.00';
  allocTotalRow.getCell(6).numFmt = '$#,##0.00';
  allocTotalRow.getCell(7).numFmt = '$#,##0.00';

  return workbook;
}

// Export unused utility functions to suppress lint warnings
export { setCurrencyFormat, setPercentageFormat };

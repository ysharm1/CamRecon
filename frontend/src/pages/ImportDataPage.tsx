import { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useImportUpload,
  useImportValidate,
  useImportExecute,
  ImportType,
  ParsedRow,
  ValidationError,
} from '@/hooks/useImport';
import { EmptyState } from '@/components/EmptyState';

const IMPORT_TYPES: { value: ImportType; label: string; description: string }[] = [
  { value: 'properties', label: 'Properties', description: 'Create properties in bulk from a spreadsheet.' },
  { value: 'tenants', label: 'Tenants', description: 'Add tenants across one or more properties.' },
  { value: 'lease_terms', label: 'Lease terms', description: 'Populate lease start/end, base rent, and CAM caps.' },
  { value: 'expenses', label: 'Expenses', description: 'Load CAM expense line items for a reconciliation.' },
];

type Step = 'choose' | 'upload' | 'validate' | 'done';

export function ImportDataPage() {
  const [step, setStep] = useState<Step>('choose');
  const [importType, setImportType] = useState<ImportType>('properties');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [validation, setValidation] = useState<{
    validCount: number;
    errorCount: number;
    errors: ValidationError[];
  } | null>(null);
  const [imported, setImported] = useState(0);

  const uploadMutation = useImportUpload();
  const validateMutation = useImportValidate();
  const executeMutation = useImportExecute();

  async function handleFileChange(file: File | null) {
    if (!file) return;
    try {
      const result = await uploadMutation.mutateAsync(file);
      setRows(result.data.rows);
      setColumns(result.data.columns);
      setFileName(result.data.fileName);
      setStep('validate');

      // Auto-validate
      const v = await validateMutation.mutateAsync({ rows: result.data.rows, importType });
      setValidation({
        validCount: v.data.validCount,
        errorCount: v.data.errorCount,
        errors: v.data.errors,
      });
    } catch {
      toast.error('Failed to parse file. Check the format and try again.');
    }
  }

  async function handleImport() {
    try {
      const result = await executeMutation.mutateAsync({ rows, importType });
      setImported(result.data.imported);
      setStep('done');
      toast.success(`Imported ${result.data.imported} row${result.data.imported === 1 ? '' : 's'}.`);
    } catch {
      toast.error('Import failed.');
    }
  }

  function reset() {
    setStep('choose');
    setRows([]);
    setColumns([]);
    setFileName('');
    setValidation(null);
    setImported(0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Import data</h2>
        <p className="mt-1 text-sm text-gray-600">
          Bulk-import properties, tenants, lease terms, or expenses from a CSV or Excel file.
        </p>
      </div>

      {/* Step 1: Choose import type */}
      {step === 'choose' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">What do you want to import?</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {IMPORT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setImportType(t.value);
                  setStep('upload');
                }}
                className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                    <p className="mt-1 text-xs text-gray-500">{t.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Importing:</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
              {IMPORT_TYPES.find((t) => t.value === importType)?.label}
            </span>
            <button
              type="button"
              onClick={reset}
              className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Change
            </button>
          </div>

          <label
            className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 text-center transition-colors hover:border-indigo-400"
          >
            <Upload className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              Click to choose a CSV or Excel file
            </p>
            <p className="mt-1 text-xs text-gray-500">Up to 10MB. First row should contain headers.</p>
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              disabled={uploadMutation.isPending}
            />
          </label>

          {uploadMutation.isPending && (
            <p className="text-xs text-gray-500">Parsing file…</p>
          )}
        </div>
      )}

      {/* Step 3: Validate */}
      {step === 'validate' && validation && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <FileSpreadsheet className="h-6 w-6 flex-shrink-0 text-indigo-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{fileName}</p>
              <p className="text-xs text-gray-500">
                {rows.length} row{rows.length === 1 ? '' : 's'} · {columns.length} columns
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">
                  {validation.validCount} valid
                </p>
              </div>
            </div>
            <div
              className={`rounded-lg border p-4 ${
                validation.errorCount > 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle
                  className={`h-5 w-5 ${
                    validation.errorCount > 0 ? 'text-red-600' : 'text-gray-400'
                  }`}
                />
                <p
                  className={`text-sm font-medium ${
                    validation.errorCount > 0 ? 'text-red-900' : 'text-gray-700'
                  }`}
                >
                  {validation.errorCount} error{validation.errorCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          {validation.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-white">
              <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
                Rows that need attention
              </div>
              <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                {validation.errors.slice(0, 50).map((err, i) => (
                  <li key={i} className="px-4 py-2 text-xs">
                    <span className="font-semibold text-gray-700">Row {err.row}</span>
                    <span className="text-gray-500"> · {err.field}</span>
                    <span className="text-gray-600"> — {err.message}</span>
                  </li>
                ))}
                {validation.errors.length > 50 && (
                  <li className="px-4 py-2 text-xs italic text-gray-500">
                    …and {validation.errors.length - 50} more.
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={validation.validCount === 0 || executeMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {executeMutation.isPending
                ? 'Importing…'
                : `Import ${validation.validCount} row${validation.validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <EmptyState
          icon={CheckCircle2}
          title={`Imported ${imported} row${imported === 1 ? '' : 's'}`}
          description="Your records are live. Review them on the relevant page or import another batch."
          action={
            <button
              type="button"
              onClick={reset}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Import more
            </button>
          }
        />
      )}
    </div>
  );
}

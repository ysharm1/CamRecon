/**
 * OnboardingPage
 *
 * Multi-step wizard for guided setup:
 * 1) Organization setup
 * 2) Import properties
 * 3) Import tenants
 * 4) Upload leases
 * 5) Review & confirm
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, FileText, CheckCircle, Upload, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  useImportUpload,
  useImportValidate,
  useImportExecute,
  ParsedRow,
  ImportType,
  ValidationError,
} from '@/hooks/useImport';
import toast from 'react-hot-toast';

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { number: 1, title: 'Organization', icon: Building2 },
  { number: 2, title: 'Properties', icon: Building2 },
  { number: 3, title: 'Tenants', icon: Users },
  { number: 4, title: 'Leases', icon: FileText },
  { number: 5, title: 'Review', icon: CheckCircle },
] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1 state
  const [orgName, setOrgName] = useState(user?.organizationId ? 'My Organization' : '');

  // Step 2 state
  const [propertiesFile, setPropertiesFile] = useState<File | null>(null);
  const [propertiesRows, setPropertiesRows] = useState<ParsedRow[]>([]);
  const [propertiesImported, setPropertiesImported] = useState(false);

  // Step 3 state
  const [tenantsFile, setTenantsFile] = useState<File | null>(null);
  const [tenantsRows, setTenantsRows] = useState<ParsedRow[]>([]);
  const [tenantsImported, setTenantsImported] = useState(false);

  // Step 4 state
  const [leaseFiles, setLeaseFiles] = useState<File[]>([]);
  const [leasesUploaded, setLeasesUploaded] = useState(false);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Mutations
  const uploadMutation = useImportUpload();
  const validateMutation = useImportValidate();
  const executeMutation = useImportExecute();

  const handleFileUpload = useCallback(async (file: File, importType: ImportType) => {
    try {
      const result = await uploadMutation.mutateAsync(file);
      const rows = result.data.rows;

      // Validate
      const validation = await validateMutation.mutateAsync({ rows, importType });

      if (validation.data.errorCount > 0) {
        setValidationErrors(validation.data.errors);
      } else {
        setValidationErrors([]);
      }

      return { rows: validation.data.valid, errors: validation.data.errors };
    } catch {
      toast.error('Failed to parse file');
      return { rows: [], errors: [] };
    }
  }, [uploadMutation, validateMutation]);

  const handlePropertiesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPropertiesFile(file);
    const result = await handleFileUpload(file, 'properties');
    setPropertiesRows(result.rows);
  };

  const handleTenantsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTenantsFile(file);
    const result = await handleFileUpload(file, 'tenants');
    setTenantsRows(result.rows);
  };

  const handleLeaseFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setLeaseFiles(Array.from(files));
    setLeasesUploaded(true);
  };

  const handleImportProperties = async () => {
    if (propertiesRows.length === 0) return;
    try {
      const result = await executeMutation.mutateAsync({ rows: propertiesRows, importType: 'properties' });
      if (result.data.imported > 0) {
        setPropertiesImported(true);
        toast.success(`Imported ${result.data.imported} properties`);
      }
      if (result.data.errors.length > 0) {
        setValidationErrors(result.data.errors);
      }
    } catch {
      toast.error('Failed to import properties');
    }
  };

  const handleImportTenants = async () => {
    if (tenantsRows.length === 0) return;
    try {
      const result = await executeMutation.mutateAsync({ rows: tenantsRows, importType: 'tenants' });
      if (result.data.imported > 0) {
        setTenantsImported(true);
        toast.success(`Imported ${result.data.imported} tenants`);
      }
      if (result.data.errors.length > 0) {
        setValidationErrors(result.data.errors);
      }
    } catch {
      toast.error('Failed to import tenants');
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return orgName.trim().length > 0;
      case 2:
        return propertiesImported || propertiesRows.length === 0;
      case 3:
        return tenantsImported || tenantsRows.length === 0;
      case 4:
        return true; // Lease upload is optional
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as WizardStep);
      setValidationErrors([]);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
      setValidationErrors([]);
    }
  };

  const handleComplete = () => {
    toast.success('Onboarding complete! Welcome to PropDoc.');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Building2 className="h-7 w-7 text-indigo-600" />
          <span className="text-lg font-semibold text-gray-900">PropDoc Setup</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.number === currentStep
                    ? 'bg-indigo-600 text-white'
                    : step.number < currentStep
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.number < currentStep ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  step.number
                )}
              </div>
              <span className="text-xs mt-1 text-gray-600">{step.title}</span>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2 text-center">
          Step {currentStep} of 5
        </p>
      </div>

      {/* Step content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {currentStep === 1 && (
            <StepOrganization orgName={orgName} setOrgName={setOrgName} />
          )}
          {currentStep === 2 && (
            <StepProperties
              file={propertiesFile}
              rows={propertiesRows}
              imported={propertiesImported}
              errors={validationErrors}
              onFileChange={handlePropertiesUpload}
              onImport={handleImportProperties}
              isLoading={uploadMutation.isPending || validateMutation.isPending || executeMutation.isPending}
            />
          )}
          {currentStep === 3 && (
            <StepTenants
              file={tenantsFile}
              rows={tenantsRows}
              imported={tenantsImported}
              errors={validationErrors}
              onFileChange={handleTenantsUpload}
              onImport={handleImportTenants}
              isLoading={uploadMutation.isPending || validateMutation.isPending || executeMutation.isPending}
            />
          )}
          {currentStep === 4 && (
            <StepLeases
              files={leaseFiles}
              uploaded={leasesUploaded}
              onFileChange={handleLeaseFilesUpload}
            />
          )}
          {currentStep === 5 && (
            <StepReview
              orgName={orgName}
              propertiesCount={propertiesRows.length}
              tenantsCount={tenantsRows.length}
              leasesCount={leaseFiles.length}
              propertiesImported={propertiesImported}
              tenantsImported={tenantsImported}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {currentStep < 5 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Complete Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Step Components ---

function StepOrganization({ orgName, setOrgName }: { orgName: string; setOrgName: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Organization Setup</h2>
      <p className="text-gray-600 mb-6">Let's start by confirming your organization details.</p>
      <div>
        <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
          Organization Name
        </label>
        <input
          id="org-name"
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter your organization name"
        />
      </div>
    </div>
  );
}

function StepProperties({
  file,
  rows,
  imported,
  errors,
  onFileChange,
  onImport,
  isLoading,
}: {
  file: File | null;
  rows: ParsedRow[];
  imported: boolean;
  errors: ValidationError[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  isLoading: boolean;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Properties</h2>
      <p className="text-gray-600 mb-6">
        Upload a CSV or Excel file with your properties. Required columns: name, street, city, state, zip, total_square_footage, property_type.
      </p>

      <FileUploadArea
        accept=".csv,.xlsx,.xls"
        file={file}
        onChange={onFileChange}
        label="Upload properties file"
      />

      {rows.length > 0 && !imported && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">{rows.length} valid rows ready to import</p>
          <button
            onClick={onImport}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Import Properties'}
          </button>
        </div>
      )}

      {imported && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Properties imported successfully
          </p>
        </div>
      )}

      <ErrorList errors={errors} />

      <p className="text-sm text-gray-500 mt-4">
        You can skip this step and add properties manually later.
      </p>
    </div>
  );
}

function StepTenants({
  file,
  rows,
  imported,
  errors,
  onFileChange,
  onImport,
  isLoading,
}: {
  file: File | null;
  rows: ParsedRow[];
  imported: boolean;
  errors: ValidationError[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  isLoading: boolean;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Tenants</h2>
      <p className="text-gray-600 mb-6">
        Upload a CSV or Excel file with your tenants. Required columns: name, contact_email, property_name, suite_number, square_footage.
      </p>

      <FileUploadArea
        accept=".csv,.xlsx,.xls"
        file={file}
        onChange={onFileChange}
        label="Upload tenants file"
      />

      {rows.length > 0 && !imported && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">{rows.length} valid rows ready to import</p>
          <button
            onClick={onImport}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Import Tenants'}
          </button>
        </div>
      )}

      {imported && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Tenants imported successfully
          </p>
        </div>
      )}

      <ErrorList errors={errors} />

      <p className="text-sm text-gray-500 mt-4">
        You can skip this step and add tenants manually later.
      </p>
    </div>
  );
}

function StepLeases({
  files,
  uploaded,
  onFileChange,
}: {
  files: File[];
  uploaded: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Leases</h2>
      <p className="text-gray-600 mb-6">
        Drag and drop or select lease documents (PDF, DOCX). These will be processed for automatic abstraction.
      </p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
        <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-2">Drop lease files here or click to browse</p>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.doc"
          onChange={onFileChange}
          className="hidden"
          id="lease-upload"
        />
        <label
          htmlFor="lease-upload"
          className="inline-block px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md cursor-pointer hover:bg-indigo-100"
        >
          Select Files
        </label>
      </div>

      {uploaded && files.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">{files.length} file(s) selected:</p>
          <ul className="space-y-1">
            {files.map((file, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-gray-500 mt-4">
        You can skip this step and upload leases later from the Documents page.
      </p>
    </div>
  );
}

function StepReview({
  orgName,
  propertiesCount,
  tenantsCount,
  leasesCount,
  propertiesImported,
  tenantsImported,
}: {
  orgName: string;
  propertiesCount: number;
  tenantsCount: number;
  leasesCount: number;
  propertiesImported: boolean;
  tenantsImported: boolean;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Review & Confirm</h2>
      <p className="text-gray-600 mb-6">Here's a summary of your setup. Click "Complete Setup" to finish.</p>

      <div className="space-y-4">
        <ReviewItem
          label="Organization"
          value={orgName}
          status="complete"
        />
        <ReviewItem
          label="Properties"
          value={propertiesImported ? `${propertiesCount} imported` : propertiesCount > 0 ? `${propertiesCount} ready` : 'Skipped'}
          status={propertiesImported ? 'complete' : 'skipped'}
        />
        <ReviewItem
          label="Tenants"
          value={tenantsImported ? `${tenantsCount} imported` : tenantsCount > 0 ? `${tenantsCount} ready` : 'Skipped'}
          status={tenantsImported ? 'complete' : 'skipped'}
        />
        <ReviewItem
          label="Lease Documents"
          value={leasesCount > 0 ? `${leasesCount} file(s) uploaded` : 'Skipped'}
          status={leasesCount > 0 ? 'complete' : 'skipped'}
        />
      </div>
    </div>
  );
}

// --- Shared Components ---

function FileUploadArea({
  accept,
  file,
  onChange,
  label,
}: {
  accept: string;
  file: File | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
}) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
      {file ? (
        <p className="text-sm text-gray-700">{file.name}</p>
      ) : (
        <p className="text-sm text-gray-600">{label}</p>
      )}
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
        id={`file-${label}`}
      />
      <label
        htmlFor={`file-${label}`}
        className="inline-block mt-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md cursor-pointer hover:bg-indigo-100"
      >
        {file ? 'Change File' : 'Select File'}
      </label>
    </div>
  );
}

function ErrorList({ errors }: { errors: ValidationError[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
      <p className="text-sm font-medium text-red-700 mb-2">Validation Errors ({errors.length}):</p>
      <ul className="space-y-1 max-h-40 overflow-y-auto">
        {errors.slice(0, 10).map((err, idx) => (
          <li key={idx} className="text-xs text-red-600">
            Row {err.row}, {err.field}: {err.message}
          </li>
        ))}
        {errors.length > 10 && (
          <li className="text-xs text-red-500 italic">...and {errors.length - 10} more</li>
        )}
      </ul>
    </div>
  );
}

function ReviewItem({ label, value, status }: { label: string; value: string; status: 'complete' | 'skipped' }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">{value}</p>
      </div>
      <span
        className={`text-xs font-medium px-2 py-1 rounded-full ${
          status === 'complete'
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {status === 'complete' ? 'Done' : 'Skipped'}
      </span>
    </div>
  );
}

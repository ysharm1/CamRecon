import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileText, X, Check, Loader2, AlertCircle, Brain, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Modal, ModalFooter } from './Modal';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { useUploadDocument } from '@/hooks/useDocuments';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';

const DOCUMENT_TYPES = [
  { value: 'lease', label: 'Lease' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'cam_report', label: 'CAM Report' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'other', label: 'Other' },
];

type Status = 'queued' | 'uploading' | 'success' | 'error';

interface UploadEntry {
  id: string;
  file: File;
  documentType: string;
  progress: number;
  status: Status;
  error?: string;
}

/**
 * Auto-detect the document type from the filename.
 */
function detectDocumentType(name: string): string {
  const lower = name.toLowerCase();
  if (/(amend|addend)/.test(lower)) return 'amendment';
  if (/(lease|leas)/.test(lower)) return 'lease';
  if (/(cam|reconcil|recon)/.test(lower)) return 'cam_report';
  if (/(insur|coi|certificate)/.test(lower)) return 'insurance';
  if (/(letter|email|correspondence|memo)/.test(lower)) return 'correspondence';
  return 'other';
}

/**
 * Strips the extension for use as the default title.
 */
function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/**
 * Global upload modal triggered from the FAB or command palette.
 * Supports drag-and-drop, multi-file, and per-file type/progress.
 */
export function UploadModal() {
  const { active, contexts, close } = useGlobalUI();
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: properties } = useProperties();
  const { data: tenants } = useTenants(propertyId || undefined);
  const uploadMutation = useUploadDocument();
  const navigate = useNavigate();

  const isOpen = active === 'upload';

  useEffect(() => {
    if (isOpen) {
      setEntries([]);
      setPropertyId(contexts.upload?.propertyId ?? '');
      setTenantId(contexts.upload?.tenantId ?? '');
    }
  }, [isOpen, contexts]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    const fresh: UploadEntry[] = list.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      documentType: detectDocumentType(file.name),
      progress: 0,
      status: 'queued',
    }));
    setEntries((prev) => [...prev, ...fresh]);
  }, []);

  function updateEntry(id: string, patch: Partial<UploadEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  async function handleUploadAll() {
    if (!propertyId) {
      toast.error('Select a property for these documents.');
      return;
    }
    if (entries.filter((e) => e.status !== 'success').length === 0) {
      toast.error('Add at least one file.');
      return;
    }

    let successCount = 0;
    let leaseCount = 0;

    for (const entry of entries) {
      if (entry.status === 'success') continue;
      updateEntry(entry.id, { status: 'uploading', progress: 10, error: undefined });

      // Simulated upload progress — fetch doesn't expose progress events without XHR.
      const interval = window.setInterval(() => {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id && e.status === 'uploading'
              ? { ...e, progress: Math.min(e.progress + Math.random() * 18, 90) }
              : e,
          ),
        );
      }, 250);

      try {
        const formData = new FormData();
        formData.append('file', entry.file);
        formData.append('title', stripExtension(entry.file.name));
        formData.append('documentType', entry.documentType);
        formData.append('propertyId', propertyId);
        if (tenantId) formData.append('tenantId', tenantId);

        await uploadMutation.mutateAsync(formData);
        window.clearInterval(interval);
        updateEntry(entry.id, { status: 'success', progress: 100 });
        successCount++;
        if (entry.documentType === 'lease') leaseCount++;
      } catch (err) {
        window.clearInterval(interval);
        const message = err instanceof Error ? err.message : 'Upload failed';
        updateEntry(entry.id, { status: 'error', progress: 0, error: message });
      }
    }

    if (successCount > 0) {
      if (leaseCount > 0) {
        const leaseLabel = `lease${leaseCount === 1 ? '' : 's'}`;
        toast.custom(
          (t) => (
            <div
              className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-indigo-200 bg-white p-3 shadow-lg ${
                t.visible ? 'animate-in fade-in' : 'animate-out fade-out'
              }`}
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50">
                <Brain className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium text-gray-900">
                  AI is analyzing your {leaseLabel}…
                </p>
                <p className="text-xs text-gray-500">
                  {successCount} file{successCount === 1 ? '' : 's'} uploaded. Extraction usually finishes in seconds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate('/abstractions');
                }}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Review
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ),
          { duration: 6000 },
        );
      } else {
        toast.success(`${successCount} file${successCount === 1 ? '' : 's'} uploaded.`);
      }
      // Close when everything succeeded
      if (successCount === entries.length) {
        setTimeout(close, 400);
      }
    }
  }

  const hasPendingUploads = useMemo(
    () => entries.some((e) => e.status === 'queued' || e.status === 'error'),
    [entries],
  );

  const isUploading = entries.some((e) => e.status === 'uploading');

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        if (isUploading) return;
        close();
      }}
      title="Upload documents"
      description="Drop in one or more files. We'll auto-detect the type."
      size="xl"
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <Upload className="h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-700">
            <span className="font-medium text-indigo-600">Click to browse</span> or drag files here
          </p>
          <p className="mt-1 text-xs text-gray-500">PDF, DOCX up to 100MB each</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Property <span className="text-red-500">*</span>
            </span>
            <select
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setTenantId('');
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a property...</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Tenant (optional)</span>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={!propertyId}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            >
              <option value="">None</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {entries.length > 0 && (
          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{entry.file.name}</p>
                    <select
                      value={entry.documentType}
                      onChange={(e) => updateEntry(entry.id, { documentType: e.target.value })}
                      disabled={entry.status === 'uploading' || entry.status === 'success'}
                      className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-0 disabled:bg-gray-100"
                    >
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full transition-all ${
                          entry.status === 'error'
                            ? 'bg-red-500'
                            : entry.status === 'success'
                              ? 'bg-green-500'
                              : 'bg-indigo-600'
                        }`}
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                    <StatusIcon status={entry.status} type={entry.documentType} />
                  </div>
                  {entry.error && (
                    <p className="mt-1 text-xs text-red-600">{entry.error}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  disabled={entry.status === 'uploading'}
                  className="rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModalFooter>
        <button
          type="button"
          onClick={close}
          disabled={isUploading}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {entries.some((e) => e.status === 'success') ? 'Done' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={handleUploadAll}
          disabled={!hasPendingUploads || isUploading || !propertyId}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload {entries.filter((e) => e.status !== 'success').length || ''}
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  );
}

function StatusIcon({ status, type }: { status: Status; type: string }) {
  if (status === 'uploading') return <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />;
  if (status === 'success') {
    if (type === 'lease') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
          <Brain className="h-3.5 w-3.5" /> Analyzing
        </span>
      );
    }
    return <Check className="h-4 w-4 text-green-600" />;
  }
  if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-500" />;
  return <span className="text-xs text-gray-400">Ready</span>;
}

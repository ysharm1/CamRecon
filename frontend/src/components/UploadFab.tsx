import { Upload } from 'lucide-react';
import { useGlobalUI } from '@/hooks/useCommandPalette';

/**
 * Floating action button for quick document uploads from anywhere.
 */
export function UploadFab() {
  const { open, active } = useGlobalUI();

  // Hide while any modal is open so it doesn't cover the dialog.
  if (active) return null;

  return (
    <button
      type="button"
      onClick={() => open('upload')}
      className="fixed bottom-20 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 sm:h-14 sm:w-auto sm:gap-2 sm:px-5 lg:bottom-6 lg:right-6"
      aria-label="Upload document"
      title="Upload document"
    >
      <Upload className="h-5 w-5" />
      <span className="hidden text-sm font-medium sm:inline">Upload</span>
    </button>
  );
}

import { Toaster } from 'react-hot-toast';

/**
 * Global toast notification container.
 * Place this once at the app root level.
 */
export function Toast() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: '8px',
          background: '#fff',
          color: '#1f2937',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          fontSize: '14px',
        },
        success: {
          iconTheme: {
            primary: '#4f46e5',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
          duration: 5000,
        },
      }}
    />
  );
}

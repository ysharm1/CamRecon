import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { CommandPalette } from '@/components/CommandPalette';
import { UploadModal } from '@/components/UploadModal';
import { QuickAddPropertyModal } from '@/components/QuickAddPropertyModal';
import { QuickAddTenantModal } from '@/components/QuickAddTenantModal';
import { QuickAddReconciliationModal } from '@/components/QuickAddReconciliationModal';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { UploadFab } from '@/components/UploadFab';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileNav } from '@/components/MobileNav';
import { useGlobalUI, GlobalUIProvider } from '@/hooks/useCommandPalette';
import { useKeyboardShortcuts, useKeySequences } from '@/hooks/useKeyboardShortcuts';

function MainLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { open, close, active } = useGlobalUI();
  const navigate = useNavigate();

  // Global shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      mod: true,
      allowInInputs: true,
      description: 'Open command palette',
      handler: () => open('commandPalette'),
    },
    {
      key: '/',
      mod: true,
      allowInInputs: true,
      description: 'Show keyboard shortcuts',
      handler: () => open('shortcuts'),
    },
    {
      key: 'Escape',
      allowInInputs: true,
      preventDefault: false,
      description: 'Close modals',
      handler: () => {
        if (active) close();
      },
    },
  ]);

  // Leader-key sequences
  useKeySequences([
    { keys: ['g', 'd'], description: 'Go to dashboard', handler: () => navigate('/') },
    { keys: ['g', 'p'], description: 'Go to properties', handler: () => navigate('/properties') },
    { keys: ['g', 't'], description: 'Go to tenants', handler: () => navigate('/tenants') },
    { keys: ['g', 'o'], description: 'Go to documents', handler: () => navigate('/documents') },
    { keys: ['g', 'r'], description: 'Go to reconciliations', handler: () => navigate('/reconciliations') },
    { keys: ['g', 'a'], description: 'Go to abstractions', handler: () => navigate('/abstractions') },
    { keys: ['c', 'p'], description: 'New property', handler: () => open('quickAddProperty') },
    { keys: ['c', 't'], description: 'New tenant', handler: () => open('quickAddTenant') },
    { keys: ['c', 'r'], description: 'New reconciliation', handler: () => open('quickAddReconciliation') },
    { keys: ['c', 'u'], description: 'Upload document', handler: () => open('upload') },
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette />
      <UploadModal />
      <QuickAddPropertyModal />
      <QuickAddTenantModal />
      <QuickAddReconciliationModal />
      <KeyboardShortcutsModal />
      <UploadFab />
      <MobileNav />
    </div>
  );
}

export function MainLayout() {
  return (
    <GlobalUIProvider>
      <MainLayoutInner />
    </GlobalUIProvider>
  );
}

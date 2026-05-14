import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

type ModalKind =
  | 'commandPalette'
  | 'upload'
  | 'quickAddProperty'
  | 'quickAddTenant'
  | 'quickAddReconciliation'
  | 'shortcuts';

interface UploadContext {
  propertyId?: string;
  tenantId?: string;
}

interface QuickAddTenantContext {
  propertyId?: string;
}

interface QuickAddReconciliationContext {
  propertyId?: string;
}

type ModalContexts = {
  upload?: UploadContext;
  quickAddTenant?: QuickAddTenantContext;
  quickAddReconciliation?: QuickAddReconciliationContext;
};

interface GlobalUIState {
  active: ModalKind | null;
  contexts: ModalContexts;
  open: (kind: ModalKind, context?: ModalContexts) => void;
  close: () => void;
  toggle: (kind: ModalKind) => void;
}

const GlobalUIContext = createContext<GlobalUIState | null>(null);

/**
 * Provides a single source of truth for global modals (command palette, upload,
 * quick-add, shortcuts) so any component can open them programmatically.
 */
export function GlobalUIProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ModalKind | null>(null);
  const [contexts, setContexts] = useState<ModalContexts>({});

  const open = useCallback((kind: ModalKind, context?: ModalContexts) => {
    setContexts(context ?? {});
    setActive(kind);
  }, []);

  const close = useCallback(() => {
    setActive(null);
    setContexts({});
  }, []);

  const toggle = useCallback(
    (kind: ModalKind) => {
      setActive((current) => (current === kind ? null : kind));
    },
    [],
  );

  const value = useMemo<GlobalUIState>(
    () => ({ active, contexts, open, close, toggle }),
    [active, contexts, open, close, toggle],
  );

  return <GlobalUIContext.Provider value={value}>{children}</GlobalUIContext.Provider>;
}

export function useGlobalUI(): GlobalUIState {
  const ctx = useContext(GlobalUIContext);
  if (!ctx) {
    throw new Error('useGlobalUI must be used inside <GlobalUIProvider>');
  }
  return ctx;
}

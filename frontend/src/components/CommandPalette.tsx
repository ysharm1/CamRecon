import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Building2,
  Users,
  FileText,
  Calculator,
  Brain,
  LayoutDashboard,
  Upload,
  FlaskConical,
  Plug,
  CreditCard,
  ArrowRight,
  Keyboard,
  LucideIcon,
  CornerDownLeft,
} from 'lucide-react';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { useProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/lib/auth';
import { getModKey } from '@/hooks/useKeyboardShortcuts';
import { isFeatureEnabled } from '@/lib/features';

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  keywords?: string[];
  section: string;
  action: () => void;
  shortcut?: string;
  /** If true, the command is excluded from the visible list. Used for feature flags. */
  hidden?: boolean;
}

/**
 * Global Cmd+K command palette. Searchable, keyboard-driven entry point
 * to every common action in the app.
 */
export function CommandPalette() {
  const { active, close, open } = useGlobalUI();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const isOpen = active === 'commandPalette';

  // Only fetch data when palette is open (avoids unnecessary requests).
  const { data: properties } = useProperties();
  const { data: tenants } = useTenants();
  const { data: documents } = useDocuments();

  // Build the full command list.
  const commands = useMemo<Command[]>(() => {
    const navigateAndClose = (path: string) => () => {
      close();
      navigate(path);
    };

    const openAndClose = (kind: Parameters<typeof open>[0]) => () => {
      close();
      // Delay re-opening slightly so the palette closes first.
      setTimeout(() => open(kind), 50);
    };

    const base: Command[] = [
      // Quick actions
      {
        id: 'new-reconciliation',
        title: 'New Reconciliation',
        subtitle: 'Start a CAM reconciliation for a property',
        icon: Calculator,
        section: 'Actions',
        keywords: ['cam', 'recon', 'create', 'start'],
        action: openAndClose('quickAddReconciliation'),
      },
      {
        id: 'upload-document',
        title: 'Upload Document',
        subtitle: 'Upload a lease, amendment, or CAM report',
        icon: Upload,
        section: 'Actions',
        keywords: ['file', 'pdf', 'upload', 'attach'],
        action: openAndClose('upload'),
      },
      {
        id: 'add-property',
        title: 'Add Property',
        subtitle: 'Create a new property in your portfolio',
        icon: Building2,
        section: 'Actions',
        keywords: ['create', 'new', 'building'],
        action: openAndClose('quickAddProperty'),
      },
      {
        id: 'add-tenant',
        title: 'Add Tenant',
        subtitle: 'Add a tenant to an existing property',
        icon: Users,
        section: 'Actions',
        keywords: ['create', 'new', 'lessee'],
        action: openAndClose('quickAddTenant'),
      },
      // Navigation
      {
        id: 'go-dashboard',
        title: 'Go to Dashboard',
        icon: LayoutDashboard,
        section: 'Navigation',
        keywords: ['home'],
        action: navigateAndClose('/dashboard'),
        shortcut: 'g d',
      },
      {
        id: 'go-properties',
        title: 'Go to Properties',
        icon: Building2,
        section: 'Navigation',
        action: navigateAndClose('/properties'),
        shortcut: 'g p',
      },
      {
        id: 'go-tenants',
        title: 'Go to Tenants',
        icon: Users,
        section: 'Navigation',
        action: navigateAndClose('/tenants'),
        shortcut: 'g t',
      },
      {
        id: 'go-documents',
        title: 'Go to Documents',
        icon: FileText,
        section: 'Navigation',
        action: navigateAndClose('/documents'),
        shortcut: 'g o',
      },
      {
        id: 'go-reconciliations',
        title: 'Go to Reconciliations',
        icon: Calculator,
        section: 'Navigation',
        action: navigateAndClose('/reconciliations'),
        shortcut: 'g r',
      },
      {
        id: 'go-abstractions',
        title: 'Go to Abstractions',
        icon: Brain,
        section: 'Navigation',
        action: navigateAndClose('/abstractions'),
        shortcut: 'g a',
      },
      {
        id: 'go-simulator',
        title: 'Open What-If Simulator',
        icon: FlaskConical,
        section: 'Navigation',
        action: navigateAndClose('/reconciliations/simulator'),
        hidden: !isFeatureEnabled('whatIfSimulator'),
      },
      {
        id: 'go-integrations',
        title: 'Go to Integrations',
        icon: Plug,
        section: 'Navigation',
        action: navigateAndClose('/integrations'),
      },
      {
        id: 'go-import',
        title: 'Go to Import Data',
        icon: Upload,
        section: 'Navigation',
        keywords: ['csv', 'excel', 'bulk'],
        action: navigateAndClose('/import'),
      },
      // Help
      {
        id: 'show-shortcuts',
        title: 'Keyboard Shortcuts',
        icon: Keyboard,
        section: 'Help',
        action: openAndClose('shortcuts'),
        shortcut: `${getModKey()} /`,
      },
    ];

    if (user?.role === 'admin' && isFeatureEnabled('billingDashboard')) {
      base.push({
        id: 'go-billing',
        title: 'Go to Billing',
        icon: CreditCard,
        section: 'Navigation',
        action: navigateAndClose('/billing'),
      });
    }

    // Jump-to records
    (properties ?? []).forEach((p) => {
      base.push({
        id: `property-${p.id}`,
        title: p.name,
        subtitle: `${p.propertyType} · ${p.totalSquareFootage.toLocaleString()} sqft`,
        icon: Building2,
        section: 'Properties',
        keywords: [p.propertyType],
        action: navigateAndClose(`/properties/${p.id}`),
      });
    });

    (tenants ?? []).slice(0, 25).forEach((t) => {
      base.push({
        id: `tenant-${t.id}`,
        title: t.name,
        subtitle: `${t.propertyName ?? ''} · Suite ${t.suiteNumber}`,
        icon: Users,
        section: 'Tenants',
        keywords: [t.contactEmail, t.suiteNumber],
        action: navigateAndClose(`/tenants/${t.id}`),
      });
    });

    (documents ?? []).slice(0, 20).forEach((d) => {
      base.push({
        id: `document-${d.id}`,
        title: d.title,
        subtitle: `${d.documentType.replace('_', ' ')}${d.propertyName ? ` · ${d.propertyName}` : ''}`,
        icon: FileText,
        section: 'Documents',
        keywords: [d.documentType],
        action: navigateAndClose(`/documents/${d.id}`),
      });
    });

    return base;
  }, [properties, tenants, documents, user, navigate, open, close]);

  // Filter commands by query (and drop any hidden by feature flags).
  const filtered = useMemo(() => {
    const visible = commands.filter((cmd) => !cmd.hidden);
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.subtitle?.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      if (cmd.section.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [commands, query]);

  // Group by section, preserving order of first appearance.
  const grouped = useMemo(() => {
    const sections: { name: string; items: Command[] }[] = [];
    for (const cmd of filtered) {
      const existing = sections.find((s) => s.name === cmd.section);
      if (existing) {
        existing.items.push(cmd);
      } else {
        sections.push({ name: cmd.section, items: [cmd] });
      }
    }
    return sections;
  }, [filtered]);

  // Reset state when palette opens.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keep the selected index in bounds after filtering.
  useEffect(() => {
    setSelectedIndex((prev) => (prev >= filtered.length ? 0 : prev));
  }, [filtered.length]);

  // Scroll the selected item into view.
  useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) cmd.action();
    }
  }

  let itemIndex = -1;

  return (
    <Transition show={isOpen} as={Fragment} afterLeave={() => setQuery('')}>
      <Dialog as="div" className="relative z-50" onClose={close}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 pt-[10vh]">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="mx-auto max-w-xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 transition-all">
              {/* Search input */}
              <div className="flex items-center gap-2 px-4">
                <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search actions, properties, tenants, documents..."
                  className="h-12 w-full border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  aria-label="Command palette search"
                />
                <kbd className="hidden rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-sans text-gray-500 sm:inline-flex">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <ul ref={listRef} className="max-h-96 overflow-y-auto py-2">
                {grouped.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-gray-500">
                    No results for "{query}"
                  </li>
                ) : (
                  grouped.map((section) => (
                    <li key={section.name} className="mb-1">
                      <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {section.name}
                      </div>
                      <ul>
                        {section.items.map((cmd) => {
                          itemIndex++;
                          const currentIndex = itemIndex;
                          const isSelected = currentIndex === selectedIndex;
                          return (
                            <li
                              key={cmd.id}
                              data-index={currentIndex}
                              className={`mx-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-gray-800 hover:bg-gray-100'
                              }`}
                              onMouseEnter={() => setSelectedIndex(currentIndex)}
                              onClick={cmd.action}
                            >
                              <cmd.icon
                                className={`h-4 w-4 flex-shrink-0 ${
                                  isSelected ? 'text-white' : 'text-gray-400'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{cmd.title}</div>
                                {cmd.subtitle && (
                                  <div
                                    className={`truncate text-xs ${
                                      isSelected ? 'text-indigo-100' : 'text-gray-500'
                                    }`}
                                  >
                                    {cmd.subtitle}
                                  </div>
                                )}
                              </div>
                              {cmd.shortcut && (
                                <kbd
                                  className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-sans ${
                                    isSelected
                                      ? 'bg-indigo-500 text-indigo-100'
                                      : 'border border-gray-200 text-gray-500'
                                  }`}
                                >
                                  {cmd.shortcut}
                                </kbd>
                              )}
                              {isSelected && !cmd.shortcut && (
                                <ArrowRight className="h-4 w-4 flex-shrink-0 text-white" />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))
                )}
              </ul>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 px-4 py-2 text-[11px] text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-gray-200 px-1 py-0.5">↑</kbd>
                    <kbd className="rounded border border-gray-200 px-1 py-0.5">↓</kbd>
                    navigate
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="inline-flex items-center rounded border border-gray-200 px-1 py-0.5">
                      <CornerDownLeft className="h-3 w-3" />
                    </kbd>
                    select
                  </span>
                </div>
                <span>{filtered.length} results</span>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

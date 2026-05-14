import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Calculator,
  Brain,
  Search,
  Plug,
  Upload,
  CreditCard,
  Plus,
  X,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { getModKey } from '@/hooks/useKeyboardShortcuts';
import { isFeatureEnabled } from '@/lib/features';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  quickAdd?: 'quickAddProperty' | 'quickAddTenant' | 'upload' | 'quickAddReconciliation';
}

const primaryNav: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Properties', href: '/properties', icon: Building2, quickAdd: 'quickAddProperty' },
  { name: 'Tenants', href: '/tenants', icon: Users, quickAdd: 'quickAddTenant' },
  { name: 'Documents', href: '/documents', icon: FileText, quickAdd: 'upload' },
  { name: 'Abstractions', href: '/abstractions', icon: Brain },
  { name: 'Reconciliations', href: '/reconciliations', icon: Calculator, quickAdd: 'quickAddReconciliation' },
  { name: 'Search', href: '/search', icon: Search },
];

const settingsNav: NavItem[] = [
  { name: 'Integrations', href: '/integrations', icon: Plug },
  { name: 'Import Data', href: '/import', icon: Upload },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { open: openModal } = useGlobalUI();
  const mod = getModKey();
  const billingOn = isFeatureEnabled('billingDashboard');

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-600/75 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transform transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / App name */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-indigo-600" />
            <span className="text-lg font-semibold text-gray-900">PropDoc</span>
          </div>
          <button
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 lg:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {primaryNav.map((item) => (
              <li key={item.name}>
                <NavRow item={item} onClose={onClose} onQuickAdd={openModal} />
              </li>
            ))}
          </ul>

          {/* Settings — small, secondary */}
          <div className="mt-8">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Settings
            </p>
            <ul className="space-y-0.5">
              {settingsNav.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </NavLink>
                </li>
              ))}
              {billingOn && user?.role === 'admin' && (
                <li>
                  <NavLink
                    to="/billing"
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`
                    }
                  >
                    <CreditCard className="h-4 w-4 flex-shrink-0" />
                    Billing
                  </NavLink>
                </li>
              )}
            </ul>
          </div>
        </nav>

        {/* Footer hint */}
        <div className="border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={() => openModal('commandPalette')}
            className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 hover:bg-gray-100"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              Search or run command
            </span>
            <span className="inline-flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-gray-600">
              {mod}K
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

function NavRow({
  item,
  onClose,
  onQuickAdd,
}: {
  item: NavItem;
  onClose: () => void;
  onQuickAdd: (kind: 'quickAddProperty' | 'quickAddTenant' | 'upload' | 'quickAddReconciliation') => void;
}) {
  return (
    <div className="group flex items-center">
      <NavLink
        to={item.href}
        onClick={onClose}
        className={({ isActive }) =>
          `flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }`
        }
        end={item.href === '/dashboard'}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {item.name}
      </NavLink>
      {item.quickAdd && (
        <button
          type="button"
          onClick={() => {
            onClose();
            if (item.quickAdd) onQuickAdd(item.quickAdd);
          }}
          className="mr-1 rounded-md p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-indigo-50 hover:text-indigo-600 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Quick add ${item.name.toLowerCase()}`}
          title={`Quick add ${item.name.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

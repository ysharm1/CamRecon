import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { Menu as MenuIcon, Bell, Search, ChevronDown, User, LogOut, Settings, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useNotifications, useMarkNotificationRead, useUnreadCount, Notification } from '@/hooks/useNotifications';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { getModKey } from '@/hooks/useKeyboardShortcuts';

interface TopBarProps {
  onMenuClick: () => void;
  pageTitle?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  property_manager: 'Property Manager',
  accountant: 'Accountant',
  read_only: 'Read Only',
};

export function TopBar({ onMenuClick, pageTitle }: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { open } = useGlobalUI();
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const mod = getModKey();

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : 'Guest';

  const roleLabel = user ? ROLE_LABELS[user.role] || user.role : '';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Close notification panel on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-3 sm:gap-4 sm:px-6">
      {/* Mobile menu button */}
      <button
        className="rounded-md p-2 text-gray-400 hover:text-gray-600 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open sidebar"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {/* Page title */}
      {pageTitle && (
        <h1 className="hidden text-lg font-semibold text-gray-900 sm:block">{pageTitle}</h1>
      )}

      {/* Command palette trigger (looks like a search bar) */}
      <button
        type="button"
        onClick={() => open('commandPalette')}
        className="ml-auto flex w-full max-w-sm items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-sm text-gray-500 hover:border-gray-300 hover:bg-white"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="hidden flex-1 truncate sm:inline">Search or jump to...</span>
        <span className="flex-1 truncate sm:hidden">Search</span>
        <kbd className="inline-flex flex-shrink-0 items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-gray-500">
          <span>{mod}</span>
          <span>K</span>
        </kbd>
      </button>

      {/* Notification bell */}
      <div className="relative" ref={notificationRef}>
        <button
          className="relative rounded-md p-2 text-gray-400 hover:text-gray-600"
          aria-label="Notifications"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <NotificationPanel onClose={() => setShowNotifications(false)} />
        )}
      </div>

      {/* User menu */}
      <Menu as="div" className="relative">
        <MenuButton className="flex items-center gap-2 rounded-md p-1.5 text-sm text-gray-700 hover:bg-gray-100 sm:p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
            <User className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="hidden text-left sm:block">
            <span className="block font-medium leading-tight">{displayName}</span>
            {roleLabel && (
              <span className="block text-xs leading-tight text-gray-500">{roleLabel}</span>
            )}
          </div>
          <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
        </MenuButton>

        <MenuItems className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
          <MenuItem>
            {({ focus }) => (
              <a
                href="#"
                className={`flex items-center gap-2 px-4 py-2 text-sm ${
                  focus ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                }`}
              >
                <Settings className="h-4 w-4" />
                Settings
              </a>
            )}
          </MenuItem>
          <MenuItem>
            {({ focus }) => (
              <button
                onClick={handleLogout}
                className={`flex w-full items-center gap-2 px-4 py-2 text-sm ${
                  focus ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                }`}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            )}
          </MenuItem>
        </MenuItems>
      </Menu>
    </header>
  );
}

/**
 * Richer notification dropdown grouped by type with inline actions.
 */
function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const navigate = useNavigate();

  function handleClick(notification: Notification) {
    if (!notification.read) markAsRead.mutate(notification.id);
    const link = getNotificationLink(notification);
    if (link) {
      navigate(link);
      onClose();
    }
  }

  function handleMarkAllRead() {
    notifications?.filter((n) => !n.read).forEach((n) => markAsRead.mutate(n.id));
  }

  const groups = groupByType(notifications ?? []);
  const hasAny = (notifications ?? []).length > 0;
  const hasUnread = (notifications ?? []).some((n) => !n.read);

  return (
    <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/5 sm:w-96">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            <Check className="h-3 w-3" />
            Mark all read
          </button>
        )}
      </div>
      <div className="max-h-[28rem] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
                <div className="h-2 w-full rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : hasAny ? (
          <ul className="divide-y divide-gray-100">
            {groups.map((group) => (
              <li key={group.title}>
                <div className="bg-gray-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {group.title}
                </div>
                <ul>
                  {group.items.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                          !n.read ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && (
                            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-600" />
                          )}
                          <div className={`min-w-0 flex-1 ${!n.read ? '' : 'ml-4'}`}>
                            <p
                              className={`text-sm ${
                                !n.read ? 'font-medium text-gray-900' : 'text-gray-700'
                              }`}
                            >
                              {n.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                              {n.message}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-400">
                              {formatRelativeTime(n.createdAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-6 text-center">
            <Bell className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-700">You're all caught up</p>
            <p className="text-xs text-gray-500">We'll notify you of lease renewals, reviews, and reconciliation deadlines.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function groupByType(notifications: Notification[]) {
  const map = new Map<string, { title: string; items: Notification[] }>();
  for (const n of notifications) {
    const title = typeToGroup(n.type);
    const existing = map.get(title);
    if (existing) existing.items.push(n);
    else map.set(title, { title, items: [n] });
  }
  // Sort: unread groups first
  return Array.from(map.values()).sort((a, b) => {
    const aUnread = a.items.some((i) => !i.read) ? 0 : 1;
    const bUnread = b.items.some((i) => !i.read) ? 0 : 1;
    return aUnread - bUnread;
  });
}

function typeToGroup(type: string): string {
  switch (type) {
    case 'lease_expiration':
      return 'Lease expirations';
    case 'document_review':
    case 'abstraction':
      return 'Abstractions';
    case 'reconciliation':
      return 'Reconciliations';
    default:
      return 'Other';
  }
}

function getNotificationLink(notification: Notification): string | null {
  const metadata = notification.metadata || {};

  if (metadata.propertyId) return `/properties/${metadata.propertyId}`;
  if (metadata.documentId) return `/documents/${metadata.documentId}`;
  if (metadata.reconciliationId) return `/reconciliations`;
  if (metadata.tenantId) return `/tenants/${metadata.tenantId}`;

  switch (notification.type) {
    case 'lease_expiration':
      return '/tenants';
    case 'document_review':
    case 'abstraction':
      return '/abstractions';
    case 'reconciliation':
      return '/reconciliations';
    default:
      return null;
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

import { Fragment, ReactNode } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { MoreVertical, LucideIcon } from 'lucide-react';

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface RowActionsProps {
  actions: RowAction[];
  label?: string;
  align?: 'left' | 'right';
  trigger?: ReactNode;
}

/**
 * Dropdown menu for row-level actions. Uses HeadlessUI for keyboard nav.
 */
export function RowActions({ actions, label = 'Actions', align = 'right', trigger }: RowActionsProps) {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton
        className="inline-flex items-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label={label}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {trigger ?? <MoreVertical className="h-4 w-4" />}
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-30 mt-1 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none`}
        >
          {actions.map((action, idx) => (
            <MenuItem key={idx} disabled={action.disabled}>
              {({ focus, disabled }) => {
                const className = `flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                  disabled
                    ? 'cursor-not-allowed text-gray-400'
                    : action.variant === 'danger'
                      ? focus
                        ? 'bg-red-50 text-red-700'
                        : 'text-red-600'
                      : focus
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-700'
                }`;
                const Icon = action.icon;
                const content = (
                  <>
                    {Icon && <Icon className="h-4 w-4" />}
                    {action.label}
                  </>
                );
                if (action.href) {
                  return (
                    <a
                      href={action.href}
                      className={className}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {content}
                    </a>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick?.();
                    }}
                    className={className}
                    disabled={disabled}
                  >
                    {content}
                  </button>
                );
              }}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  );
}

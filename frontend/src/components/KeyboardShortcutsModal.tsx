import { Modal } from './Modal';
import { useGlobalUI } from '@/hooks/useCommandPalette';
import { getModKey } from '@/hooks/useKeyboardShortcuts';

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutRow[];
}

/**
 * Displays all global keyboard shortcuts in a dialog.
 */
export function KeyboardShortcutsModal() {
  const { active, close } = useGlobalUI();
  const mod = getModKey();

  const groups: ShortcutGroup[] = [
    {
      title: 'General',
      items: [
        { keys: [mod, 'K'], description: 'Open command palette' },
        { keys: [mod, '/'], description: 'Show keyboard shortcuts' },
        { keys: ['Esc'], description: 'Close dialogs and overlays' },
      ],
    },
    {
      title: 'Navigation',
      items: [
        { keys: ['g', 'd'], description: 'Go to dashboard' },
        { keys: ['g', 'p'], description: 'Go to properties' },
        { keys: ['g', 't'], description: 'Go to tenants' },
        { keys: ['g', 'o'], description: 'Go to documents' },
        { keys: ['g', 'r'], description: 'Go to reconciliations' },
        { keys: ['g', 'a'], description: 'Go to abstractions' },
      ],
    },
    {
      title: 'Quick create',
      items: [
        { keys: ['c', 'p'], description: 'New property' },
        { keys: ['c', 't'], description: 'New tenant' },
        { keys: ['c', 'r'], description: 'New reconciliation' },
        { keys: ['c', 'u'], description: 'Upload document' },
      ],
    },
    {
      title: 'Tables & lists',
      items: [
        { keys: ['j'], description: 'Next row' },
        { keys: ['k'], description: 'Previous row' },
        { keys: ['Enter'], description: 'Open highlighted row' },
        { keys: ['/'], description: 'Focus search' },
      ],
    },
  ];

  return (
    <Modal
      open={active === 'shortcuts'}
      onClose={close}
      title="Keyboard shortcuts"
      description="Work faster with these shortcuts."
      size="lg"
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {group.title}
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li
                  key={item.description}
                  className="flex items-center justify-between gap-2 text-sm text-gray-700"
                >
                  <span>{item.description}</span>
                  <span className="flex items-center gap-1">
                    {item.keys.map((k, idx) => (
                      <kbd
                        key={idx}
                        className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-gray-200 bg-gray-50 px-1.5 text-[11px] font-medium text-gray-700"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}

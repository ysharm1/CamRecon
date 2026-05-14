import { useEffect, useRef } from 'react';

/**
 * Returns true if the event originates from a text input, textarea, select,
 * or a contentEditable element.
 */
export function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export interface ShortcutBinding {
  /** The main key to match (e.g. "k", "/", "Enter"). Case-insensitive. */
  key: string;
  /** Whether the Cmd/Ctrl modifier is required (defaults to false). */
  mod?: boolean;
  /** Whether Shift must be held (defaults to false). */
  shift?: boolean;
  /** Whether to allow the shortcut when focus is in an input field. */
  allowInInputs?: boolean;
  /** Handler invoked when the shortcut fires. */
  handler: (event: KeyboardEvent) => void;
  /** Prevent default on match (defaults to true). */
  preventDefault?: boolean;
  /** Optional description for the shortcuts help modal. */
  description?: string;
}

/**
 * Subscribes to keyboard shortcuts at the document level. Supports plain keys,
 * Cmd/Ctrl combos, and a simple leader-key sequence (e.g. "g d").
 */
export function useKeyboardShortcuts(bindings: ShortcutBinding[]) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const inEditable = isEditableTarget(event);
      const key = event.key.toLowerCase();

      for (const binding of bindingsRef.current) {
        const mod = binding.mod ?? false;
        const shift = binding.shift ?? false;
        const matchKey = binding.key.toLowerCase() === key;
        const matchMod = mod ? event.metaKey || event.ctrlKey : !(event.metaKey || event.ctrlKey);
        const matchShift = shift ? event.shiftKey : !event.shiftKey;

        if (!matchKey || !matchMod || !matchShift) continue;
        if (inEditable && !binding.allowInInputs) continue;

        if (binding.preventDefault !== false) {
          event.preventDefault();
        }
        binding.handler(event);
        return;
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}

export interface SequenceBinding {
  /** Sequence of keys to press, e.g. ['g', 'd']. */
  keys: string[];
  handler: () => void;
  description?: string;
}

/**
 * Handles leader-key sequences like "g d" (go to dashboard). Resets if no
 * matching key is pressed within 800ms.
 */
export function useKeySequences(sequences: SequenceBinding[]) {
  const sequencesRef = useRef(sequences);
  sequencesRef.current = sequences;

  useEffect(() => {
    let buffer: string[] = [];
    let timeout: number | null = null;

    function reset() {
      buffer = [];
      if (timeout) {
        window.clearTimeout(timeout);
        timeout = null;
      }
    }

    function handler(event: KeyboardEvent) {
      if (isEditableTarget(event)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) {
        reset();
        return;
      }

      buffer.push(event.key.toLowerCase());
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(reset, 800);

      // Trim buffer to max sequence length
      const maxLen = Math.max(...sequencesRef.current.map((s) => s.keys.length), 1);
      if (buffer.length > maxLen) buffer = buffer.slice(-maxLen);

      for (const seq of sequencesRef.current) {
        if (buffer.length < seq.keys.length) continue;
        const tail = buffer.slice(-seq.keys.length);
        const matches = tail.every((k, i) => k === seq.keys[i].toLowerCase());
        if (matches) {
          event.preventDefault();
          seq.handler();
          reset();
          return;
        }
      }
    }

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (timeout) window.clearTimeout(timeout);
    };
  }, []);
}

/**
 * Returns "⌘" on Mac, "Ctrl" elsewhere. Safe for SSR (defaults to Ctrl).
 */
export function getModKey(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /mac|iphone|ipad/i.test(navigator.platform) ? '⌘' : 'Ctrl';
}

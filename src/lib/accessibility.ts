// Accessibility helpers: focus traps for dialogs, keyboard activation for
// custom controls, and focusable-element queries. SSR-safe.

import { createEffect, onCleanup } from 'solid-js';

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ');

export function getFocusable(container: HTMLElement | undefined | null): HTMLElement[] {
  if (!container) return [];
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter(el => el.offsetParent !== null || el === document.activeElement);
}

export function firstFocusable(container: HTMLElement | undefined | null): HTMLElement | null {
  return getFocusable(container)[0] || (container as HTMLElement) || null;
}

/**
 * Traps keyboard focus inside a dialog while `active()` is true, handles the
 * Escape key, and restores focus to the previously-focused element when the
 * dialog closes. Returns a `ref` callback to attach to the dialog element.
 */
export function useFocusTrap(active: () => boolean, onEscape?: () => void, isOpen = false) {
  let dialogRef: HTMLElement | undefined;
  let prevActive: HTMLElement | null = null;

  const setRef = (el?: HTMLElement) => {
    dialogRef = el;
  };

  createEffect(() => {
    const on = active() || isOpen;
    if (!on || !dialogRef) return;

    prevActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Move focus into the dialog on open.
    const initial = firstFocusable(dialogRef);
    (initial || dialogRef).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(dialogRef);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && (current === first || current === dialogRef || !current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    onCleanup(() => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (prevActive && document.contains(prevActive)) prevActive.focus();
      prevActive = null;
    });
  });

  return setRef;
}

/**
 * Generic Enter/Space activation for non-interactive elements ("cards", etc.)
 * that are given `role="button"` + `tabindex="0"`.
 */
export function onActivateKey(e: KeyboardEvent, action: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
}
import { isModKey } from '@/shared/keyboard';

import { SELECTORS, simulateMouseClick } from '../utils/common';

export function toggleSidebarPin(): void {
  const button = document.querySelector<HTMLButtonElement>(SELECTORS.SIDEBAR_PIN_TOGGLE);
  if (!button) return;
  simulateMouseClick(button);
}

export function initSidebarToggle(): void {
  if (window.__pinSidebarShortcutHandler) {
    window.removeEventListener('keydown', window.__pinSidebarShortcutHandler);
  }

  const handler = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    const isCmdShiftS = isModKey(e) && e.shiftKey && !e.altKey && key === 's' && !e.repeat;

    if (!isCmdShiftS) return;

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    toggleSidebarPin();
  };

  window.__pinSidebarShortcutHandler = handler;
  window.addEventListener('keydown', handler);
}

import { isModKey } from '@/shared/keyboard';

import { SELECTORS, simulateMouseClick, waitForElement } from '../utils/common';

export async function openNewChatViaSidebar(): Promise<void> {
  let newChatLink = document.querySelector<HTMLAnchorElement>(SELECTORS.NEW_CHAT_LINK);
  if (newChatLink) {
    simulateMouseClick(newChatLink);
    return;
  }

  const openSidebarButton = document.querySelector<HTMLButtonElement>(
    SELECTORS.SIDEBAR_OPEN_BUTTON
  );
  if (openSidebarButton) {
    simulateMouseClick(openSidebarButton);
  }

  try {
    newChatLink = await waitForElement<HTMLAnchorElement>(SELECTORS.NEW_CHAT_LINK);
    simulateMouseClick(newChatLink);
  } catch {
    // Silent error
  }
}

export function initNewChatShortcut(): void {
  if (window.__newChatShortcutListener) {
    window.removeEventListener('keydown', window.__newChatShortcutListener);
  }

  const listener = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    const isShortcut = isModKey(e) && e.shiftKey && !e.altKey && key === 'o';
    if (!isShortcut) return;

    e.preventDefault();
    e.stopPropagation();

    void openNewChatViaSidebar();
  };

  window.__newChatShortcutListener = listener;
  window.addEventListener('keydown', listener);
}

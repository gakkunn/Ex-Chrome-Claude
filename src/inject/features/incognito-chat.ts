import { isModKey } from '@/shared/keyboard';

import {
  SELECTORS,
  scrollIntoViewSafe,
  simulateMouseClick,
  waitFor,
  waitForElement,
} from '../utils/common';

const NEW_CHAT_LINK_SELECTOR = 'nav[aria-label="Sidebar"] a[aria-label="New chat"][href="/new"]';
const INCOGNITO_ON_SVG_SELECTOR = 'button.Button_ghost__BUAoh svg.text-bg-000[aria-hidden="true"]';
const INCOGNITO_OFF_SVG_SELECTOR =
  'button.Button_ghost__BUAoh div.group > svg.group[aria-hidden="true"]';

async function openSidebarAndClickNewChat(): Promise<void> {
  let newChatLink = document.querySelector<HTMLAnchorElement>(NEW_CHAT_LINK_SELECTOR);
  if (newChatLink) {
    simulateMouseClick(newChatLink);
    return;
  }

  const openSidebarButton = document.querySelector<HTMLButtonElement>(
    SELECTORS.SIDEBAR_OPEN_BUTTON
  );
  if (openSidebarButton) {
    scrollIntoViewSafe(openSidebarButton);
    simulateMouseClick(openSidebarButton);
  }

  try {
    newChatLink = await waitForElement<HTMLAnchorElement>(NEW_CHAT_LINK_SELECTOR, {
      timeout: 5000,
    });
    simulateMouseClick(newChatLink);
  } catch {
    // Silent error
  }
}

function findIncognitoOnButton(): HTMLButtonElement | null {
  const svgs = Array.from(document.querySelectorAll<SVGElement>(INCOGNITO_ON_SVG_SELECTOR));
  for (const svg of svgs) {
    const button = svg.closest('button');
    if (!button || button.closest('nav[aria-label="Sidebar"]')) continue;
    return button;
  }
  return null;
}

function findIncognitoOffButton(): HTMLButtonElement | null {
  const svgs = Array.from(document.querySelectorAll<SVGElement>(INCOGNITO_OFF_SVG_SELECTOR));
  for (const svg of svgs) {
    const button = svg.closest('button');
    if (!button || button.closest('nav[aria-label="Sidebar"]')) continue;
    return button;
  }
  return null;
}

async function toggleIncognitoChat(): Promise<void> {
  const onButton = findIncognitoOnButton();
  if (onButton) {
    simulateMouseClick(onButton);
    return;
  }

  await openSidebarAndClickNewChat();

  try {
    const offButton = await waitFor(findIncognitoOffButton, {
      timeout: 8000,
      interval: 100,
    });
    scrollIntoViewSafe(offButton);
    simulateMouseClick(offButton);
  } catch {
    // Silent error
  }
}

export { toggleIncognitoChat };

export function initIncognitoChatShortcut(): void {
  if (window.__incognitoChatShortcutListener) {
    window.removeEventListener('keydown', window.__incognitoChatShortcutListener);
  }

  const listener = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    const isShortcut = isModKey(e) && !e.shiftKey && !e.altKey && key === 'i';
    if (!isShortcut) return;

    e.preventDefault();
    e.stopPropagation();

    void toggleIncognitoChat();
  };

  window.__incognitoChatShortcutListener = listener;
  window.addEventListener('keydown', listener);
}

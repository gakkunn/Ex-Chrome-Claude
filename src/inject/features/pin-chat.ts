import { isModKey } from '@/shared/keyboard';

import { SELECTORS, scrollIntoViewSafe, simulateMouseClick, waitForElement } from '../utils/common';

const STAR_MENU_ITEM_SELECTOR = 'div[role="menuitem"][data-testid="star-chat-trigger"]';

function showStarToast(actionLabel: string | null | undefined): void {
  const label = (actionLabel || '').trim();
  const isUnstar = /unstar/i.test(label);
  const text = isUnstar ? 'Unstarred this chat' : 'Starred this chat';

  let toast = document.getElementById('star-chat-toast');
  if (!(toast instanceof HTMLDivElement)) {
    toast = document.createElement('div');
    toast.id = 'star-chat-toast';
    Object.assign(toast.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '999999',
      padding: '8px 12px',
      borderRadius: '999px',
      fontSize: '12px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
      opacity: '0',
      transform: 'translateY(-8px)',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(toast);
  }

  if (!(toast instanceof HTMLDivElement)) return;

  toast.textContent = text;

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  if (window.__starChatToastTimer) {
    clearTimeout(window.__starChatToastTimer);
  }

  window.__starChatToastTimer = window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
  }, 1800);
}

async function starCurrentChatViaMenu(): Promise<void> {
  let starItem = document.querySelector<HTMLElement>(STAR_MENU_ITEM_SELECTOR);
  if (starItem) {
    const labelBeforeClick = (starItem.innerText || starItem.textContent || '').trim();
    simulateMouseClick(starItem);
    showStarToast(labelBeforeClick);
    return;
  }

  const trigger = document.querySelector<HTMLElement>(SELECTORS.CHAT_MENU_TRIGGER);
  if (!trigger) return;

  scrollIntoViewSafe(trigger);
  simulateMouseClick(trigger);

  try {
    starItem = await waitForElement<HTMLElement>(STAR_MENU_ITEM_SELECTOR);
    const labelBeforeClick = (starItem.innerText || starItem.textContent || '').trim();
    simulateMouseClick(starItem);
    showStarToast(labelBeforeClick);
  } catch {
    // Silent error
  }
}

export { starCurrentChatViaMenu };

export function initPinChatShortcut(): void {
  if (window.__starChatShortcutListener) {
    window.removeEventListener('keydown', window.__starChatShortcutListener);
  }

  const listener = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    const isShortcut = isModKey(e) && e.shiftKey && !e.altKey && key === 'p';
    if (!isShortcut) return;

    e.preventDefault();
    e.stopPropagation();

    void starCurrentChatViaMenu();
  };

  window.__starChatShortcutListener = listener;
  window.addEventListener('keydown', listener);
}

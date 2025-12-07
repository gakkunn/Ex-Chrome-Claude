import { isModKey } from '@/shared/keyboard';

import { SELECTORS, scrollIntoViewSafe, simulateMouseClick, waitForElement } from '../utils/common';

const DELETE_MENU_ITEM_SELECTOR = 'div[role="menuitem"][data-testid="delete-chat-trigger"]';
const DELETE_CONFIRM_BUTTON_SELECTOR =
  'div[role="dialog"] button[data-testid="delete-modal-confirm"]';

async function openDeleteModalAndFocusConfirm(): Promise<void> {
  let confirmButton = document.querySelector<HTMLButtonElement>(DELETE_CONFIRM_BUTTON_SELECTOR);
  if (confirmButton) {
    confirmButton.focus();
    return;
  }

  let deleteItem = document.querySelector<HTMLElement>(DELETE_MENU_ITEM_SELECTOR);
  if (deleteItem) {
    simulateMouseClick(deleteItem);

    try {
      confirmButton = await waitForElement<HTMLButtonElement>(DELETE_CONFIRM_BUTTON_SELECTOR);
      confirmButton.focus();
    } catch {
      // Silent error
    }
    return;
  }

  const trigger = document.querySelector<HTMLElement>(SELECTORS.CHAT_MENU_TRIGGER);
  if (!trigger) return;

  scrollIntoViewSafe(trigger);
  simulateMouseClick(trigger);

  try {
    deleteItem = await waitForElement<HTMLElement>(DELETE_MENU_ITEM_SELECTOR);
    simulateMouseClick(deleteItem);

    confirmButton = await waitForElement<HTMLButtonElement>(DELETE_CONFIRM_BUTTON_SELECTOR);
    confirmButton.focus();
  } catch {
    // Silent error
  }
}

export { openDeleteModalAndFocusConfirm };

export function initChatDeleteShortcut(): void {
  if (window.__deleteChatShortcutListener) {
    window.removeEventListener('keydown', window.__deleteChatShortcutListener);
  }

  const listener = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    const isShortcut =
      isModKey(e) && e.shiftKey && !e.altKey && (key === 'backspace' || key === 'delete');
    if (!isShortcut) return;

    e.preventDefault();
    e.stopPropagation();

    void openDeleteModalAndFocusConfirm();
  };

  window.__deleteChatShortcutListener = listener;
  window.addEventListener('keydown', listener);
}

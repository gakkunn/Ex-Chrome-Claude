import { isModKey } from '@/shared/keyboard';

import { SELECTORS, scrollIntoViewSafe, simulateMouseClick, waitForElement } from '../utils/common';

const DELETE_MENU_ITEM_SELECTOR = 'div[role="menuitem"][data-testid="delete-chat-trigger"]';
const DELETE_CONFIRM_BUTTON_IN_DIALOG_SELECTOR = 'button[data-testid="delete-modal-confirm"]';
const DELETE_CONFIRM_BUTTON_SELECTOR = `div[role="dialog"] ${DELETE_CONFIRM_BUTTON_IN_DIALOG_SELECTOR}`;
const DELETE_CONFIRM_WAIT_TIMEOUT = 1000;
const DELETE_CONFIRM_FOCUS_TIMEOUT = 1000;
const DELETE_CONFIRM_FOCUS_RETRY_DELAYS = [0, 50, 150, 300, 500] as const;

const nativeHTMLElementFocus = HTMLElement.prototype.focus;

let confirmFocusRequestId = 0;
let cleanupConfirmFocusGuard: (() => void) | null = null;
let activeDeleteFocusRedirectId = 0;
let cleanupDeleteFocusRedirect: (() => void) | null = null;
let isDeleteFocusInterceptorInstalled = false;

function isOpenDialog(dialog: HTMLElement | null): boolean {
  if (!dialog || !dialog.isConnected) return false;
  if (dialog.getAttribute('aria-hidden') === 'true') return false;
  if (dialog.hasAttribute('hidden')) return false;

  const state = dialog.dataset.state ?? dialog.getAttribute('data-state') ?? '';
  return state === '' || state === 'open' || state === 'entered';
}

function findDeleteConfirmButton(): HTMLButtonElement | null {
  const buttons = document.querySelectorAll<HTMLButtonElement>(DELETE_CONFIRM_BUTTON_SELECTOR);
  for (const button of buttons) {
    if (isOpenDialog(button.closest<HTMLElement>('div[role="dialog"]'))) {
      return button;
    }
  }
  return null;
}

function waitForDeleteConfirmButton(): Promise<HTMLButtonElement> {
  const immediate = findDeleteConfirmButton();
  if (immediate) {
    return Promise.resolve(immediate);
  }

  return new Promise<HTMLButtonElement>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const button = findDeleteConfirmButton();
      if (!button) return;

      window.clearTimeout(timeoutId);
      observer.disconnect();
      resolve(button);
    });

    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for selector: ${DELETE_CONFIRM_BUTTON_SELECTOR}`));
    }, DELETE_CONFIRM_WAIT_TIMEOUT);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'hidden', 'aria-hidden'],
    });
  });
}

function findDeleteConfirmButtonInDialog(dialog: ParentNode | null): HTMLButtonElement | null {
  return dialog?.querySelector<HTMLButtonElement>(DELETE_CONFIRM_BUTTON_IN_DIALOG_SELECTOR) ?? null;
}

function ensureDeleteFocusInterceptor(): void {
  if (isDeleteFocusInterceptorInstalled) return;
  isDeleteFocusInterceptorInstalled = true;

  // Claude auto-focuses the first control on mount. Redirect that focus to Delete
  // during shortcut-triggered opens so users never see or activate Cancel first.
  HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions): void {
    if (activeDeleteFocusRedirectId !== 0) {
      const dialog = this.closest<HTMLElement>('div[role="dialog"]');
      if (isOpenDialog(dialog)) {
        const confirmButton = findDeleteConfirmButtonInDialog(dialog);
        if (confirmButton && confirmButton !== this) {
          nativeHTMLElementFocus.call(confirmButton, options);
          return;
        }
      }
    }

    nativeHTMLElementFocus.call(this, options);
  };
}

function activateDeleteFocusRedirect(): void {
  cleanupDeleteFocusRedirect?.();
  ensureDeleteFocusInterceptor();

  const requestId = ++activeDeleteFocusRedirectId;
  const timeoutId = window.setTimeout(() => {
    if (activeDeleteFocusRedirectId === requestId) {
      activeDeleteFocusRedirectId = 0;
    }
    if (cleanupDeleteFocusRedirect === cleanup) {
      cleanupDeleteFocusRedirect = null;
    }
  }, DELETE_CONFIRM_FOCUS_TIMEOUT);

  const cleanup = (): void => {
    window.clearTimeout(timeoutId);
    if (activeDeleteFocusRedirectId === requestId) {
      activeDeleteFocusRedirectId = 0;
    }
    if (cleanupDeleteFocusRedirect === cleanup) {
      cleanupDeleteFocusRedirect = null;
    }
  };

  cleanupDeleteFocusRedirect = cleanup;
}

async function clickDeleteItemAndFocusConfirm(deleteItem: HTMLElement): Promise<void> {
  activateDeleteFocusRedirect();
  const confirmButtonPromise = waitForDeleteConfirmButton();
  simulateMouseClick(deleteItem);

  try {
    const confirmButton = await confirmButtonPromise;
    focusDeleteConfirmButton(confirmButton);
  } catch {
    cleanupDeleteFocusRedirect?.();
    // Silent error
  }
}

function focusDeleteConfirmButton(button: HTMLButtonElement): void {
  const requestId = ++confirmFocusRequestId;
  const dialog = button.closest<HTMLElement>('div[role="dialog"]');
  const timeoutIds: number[] = [];
  const abortController = new AbortController();
  const { signal } = abortController;

  cleanupConfirmFocusGuard?.();

  const cleanup = (): void => {
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    abortController.abort();
    cleanupDeleteFocusRedirect?.();
    if (cleanupConfirmFocusGuard === cleanup) {
      cleanupConfirmFocusGuard = null;
    }
  };

  cleanupConfirmFocusGuard = cleanup;

  const shouldStop = (): boolean =>
    requestId !== confirmFocusRequestId ||
    !button.isConnected ||
    (dialog !== null && !dialog.isConnected);

  const tryFocus = (): boolean => {
    if (shouldStop()) {
      cleanup();
      return true;
    }
    if (document.activeElement === button) return true;

    button.focus();
    return document.activeElement === button;
  };

  const scheduleFocusAttempt = (delay: number): void => {
    const timeoutId = window.setTimeout(() => {
      if (shouldStop()) {
        cleanup();
        return;
      }
      tryFocus();
    }, delay);
    timeoutIds.push(timeoutId);
  };

  tryFocus();
  window.requestAnimationFrame(() => {
    void tryFocus();
  });
  DELETE_CONFIRM_FOCUS_RETRY_DELAYS.forEach((delay) => scheduleFocusAttempt(delay));

  timeoutIds.push(window.setTimeout(cleanup, DELETE_CONFIRM_FOCUS_TIMEOUT));

  if (!dialog) return;

  dialog.addEventListener(
    'focusin',
    (event) => {
      if (shouldStop()) {
        cleanup();
        return;
      }

      if (event.target === button) return;

      window.requestAnimationFrame(() => {
        if (!shouldStop()) {
          void tryFocus();
        }
      });
    },
    { capture: true, signal }
  );

  const stopGuardForUserNavigation = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      cleanup();
    }
  };

  dialog.addEventListener('keydown', stopGuardForUserNavigation, { capture: true, signal });
  dialog.addEventListener('pointerdown', cleanup, { capture: true, signal });
}

async function openDeleteModalAndFocusConfirm(): Promise<void> {
  const confirmButton = findDeleteConfirmButton();
  if (confirmButton) {
    focusDeleteConfirmButton(confirmButton);
    return;
  }

  let deleteItem = document.querySelector<HTMLElement>(DELETE_MENU_ITEM_SELECTOR);
  if (deleteItem) {
    await clickDeleteItemAndFocusConfirm(deleteItem);
    return;
  }

  const trigger = document.querySelector<HTMLElement>(SELECTORS.CHAT_MENU_TRIGGER);
  if (!trigger) return;

  scrollIntoViewSafe(trigger);
  simulateMouseClick(trigger);

  try {
    deleteItem = await waitForElement<HTMLElement>(DELETE_MENU_ITEM_SELECTOR);
    await clickDeleteItemAndFocusConfirm(deleteItem);
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

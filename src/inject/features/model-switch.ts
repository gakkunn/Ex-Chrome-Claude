import { isModKey } from '@/shared/keyboard';

import { SELECTORS, simulateMouseClick, waitFor } from '../utils/common';

const INPUT_SELECTORS = {
  RICH: 'div.tiptap.ProseMirror[contenteditable="true"][data-testid="chat-input"]',
  SSR: 'textarea[data-testid="chat-input-ssr"]',
} as const;

function focusInputAfterModelSwitch(): void {
  window.setTimeout(() => {
    const rich = document.querySelector<HTMLElement>(INPUT_SELECTORS.RICH);
    if (rich) {
      rich.focus();
      return;
    }

    const ssr = document.querySelector<HTMLElement>(INPUT_SELECTORS.SSR);
    if (ssr) {
      ssr.focus();
    }
  }, 100);
}

function getDropdownButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(SELECTORS.MODEL_DROPDOWN);
}

const MODEL_FAMILIES = ['haiku', 'sonnet', 'opus'] as const;

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function isVisibleElement(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getMenuItemModelText(item: HTMLElement): string {
  const label = item.querySelector<HTMLElement>(SELECTORS.MODEL_MENU_ITEM_LABEL);
  const labelText = normalizeText(label?.textContent);
  if (labelText) return labelText;
  return normalizeText(item.textContent);
}

function hasModelFamilyItem(menu: HTMLElement): boolean {
  const items = menu.querySelectorAll<HTMLElement>(SELECTORS.MODEL_MENU_ITEM);
  for (const item of items) {
    const text = getMenuItemModelText(item).toLowerCase();
    if (MODEL_FAMILIES.some((family) => text.startsWith(family))) {
      return true;
    }
  }
  return false;
}

function getOpenModelMenuContainer(): HTMLElement | null {
  for (const selector of SELECTORS.MODEL_MENU_CONTAINER_CANDIDATES) {
    const menus = document.querySelectorAll<HTMLElement>(selector);
    for (const menu of menus) {
      if (!isVisibleElement(menu)) continue;
      if (!hasModelFamilyItem(menu)) continue;
      return menu;
    }
  }

  return null;
}

function findModelMenuItemByName(modelName: string): HTMLElement | null {
  const menu = getOpenModelMenuContainer();
  if (!menu) return null;

  const target = normalizeText(modelName).toLowerCase();
  const items = menu.querySelectorAll<HTMLElement>(SELECTORS.MODEL_MENU_ITEM);
  for (const item of items) {
    const text = getMenuItemModelText(item).toLowerCase();
    if (text.startsWith(target)) {
      return item;
    }
  }
  return null;
}

async function ensureModelMenuOpen(): Promise<HTMLElement | null> {
  let menu = getOpenModelMenuContainer();
  if (menu) return menu;

  const dropdown = getDropdownButton();
  if (!dropdown) return null;

  simulateMouseClick(dropdown);

  try {
    menu = await waitFor(getOpenModelMenuContainer);
    return menu;
  } catch {
    return null;
  }
}

export function toggleModelDropdown(): void {
  const dropdown = getDropdownButton();
  if (!dropdown) return;
  simulateMouseClick(dropdown);
}

export async function selectModelByName(modelName: string): Promise<void> {
  const dropdown = getDropdownButton();
  if (!dropdown) return;

  let menu = getOpenModelMenuContainer();
  if (!menu) {
    simulateMouseClick(dropdown);
    menu = await ensureModelMenuOpen();
    if (!menu) return;
  }

  try {
    const item = await waitFor(() => findModelMenuItemByName(modelName));
    simulateMouseClick(item);
    focusInputAfterModelSwitch();
  } catch {
    // Silent error
  }
}

export function initModelSwitch(): void {
  const state = window.__modelShortcutState || (window.__modelShortcutState = {});

  if (state.keydownListener) {
    window.removeEventListener('keydown', state.keydownListener as EventListener, true);
    window.removeEventListener('keydown', state.keydownListener as EventListener, false);
  }
  if (state.beforeInputListener) {
    window.removeEventListener('beforeinput', state.beforeInputListener as EventListener, true);
  }

  const keydownListener = (e: KeyboardEvent): void => {
    if (!(isModKey(e) && e.shiftKey && !e.altKey)) return;

    const code = e.code;
    let action: 'toggle' | 'haiku' | 'sonnet' | 'opus' | null = null;

    if (code === 'ArrowDown') {
      action = 'toggle';
    } else if (code === 'Digit0' || code === 'Numpad0') {
      action = 'haiku';
    } else if (code === 'Digit8' || code === 'Numpad8') {
      action = 'sonnet';
    } else if (code === 'Digit9' || code === 'Numpad9') {
      action = 'opus';
    }

    if (!action) return;

    state.lastShortcutAt = performance.now();

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    window.setTimeout(() => {
      if (action === 'toggle') {
        toggleModelDropdown();
      } else if (action === 'haiku') {
        void selectModelByName('Haiku');
      } else if (action === 'sonnet') {
        void selectModelByName('Sonnet');
      } else if (action === 'opus') {
        void selectModelByName('Opus');
      }
    }, 0);
  };

  const beforeInputListener = (e: InputEvent): void => {
    if (!state.lastShortcutAt) return;
    const delta = performance.now() - state.lastShortcutAt;
    if (delta < 150) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  };

  state.keydownListener = keydownListener;
  state.beforeInputListener = beforeInputListener;

  window.addEventListener('keydown', keydownListener, { capture: true });
  window.addEventListener('beforeinput', beforeInputListener, { capture: true });
}

import { isModKey } from '@/shared/keyboard';

import { SELECTORS, simulateMouseClick, waitFor } from '../utils/common';

function getDropdownButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(SELECTORS.MODEL_DROPDOWN);
}

function getOpenModelMenuContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SELECTORS.MODEL_MENU_CONTAINER);
}

function findModelMenuItemByName(modelName: string): HTMLElement | null {
  const menu = getOpenModelMenuContainer();
  if (!menu) return null;

  const labels = menu.querySelectorAll<HTMLElement>(SELECTORS.MODEL_MENU_ITEM);
  for (const label of labels) {
    const text = label.textContent?.trim();
    if (text === modelName) {
      return label.closest<HTMLElement>('div[role="menuitem"]') ?? label;
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
        void selectModelByName('Haiku 4.5');
      } else if (action === 'sonnet') {
        void selectModelByName('Sonnet 4.5');
      } else if (action === 'opus') {
        void selectModelByName('Opus 4.5');
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

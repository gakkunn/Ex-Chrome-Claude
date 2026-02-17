import { bindingMatchesEvent, isModKey } from '../shared/keyboard';
import { MESSAGE_SOURCE, MESSAGE_TYPES } from '../shared/messages';
import {
  DEFAULT_SETTINGS,
  SHORTCUT_DEFINITIONS,
  mergeSettings,
  type KeyBinding,
  type SettingsData,
  type ShortcutDefinition,
  type ShortcutId,
} from '../shared/settings';

import { openDeleteModalAndFocusConfirm } from './features/chat-delete';
import { copyLastUserMessageViaActionBar } from './features/copy-last-message';
import { FocusManager } from './features/focus-management';
import { toggleIncognitoChat } from './features/incognito-chat';
import { toggleModelDropdown, selectModelByName } from './features/model-switch';
import { openNewChatViaSidebar } from './features/new-chat-close-sidebar';
import { starCurrentChatViaMenu } from './features/pin-chat';
import { ShortcutsDialogController } from './features/shortcuts-dialog';
import { toggleSidebarPin } from './features/sidebar';
import { UsageIndicator } from './features/usage-indicator';
import { vimScrollController, type ScrollAction } from './features/vim-scroll';
import { isKeyboardEventInEditableContext } from './utils/common';

const shortcutMap = new Map<ShortcutId, ShortcutDefinition>(
  SHORTCUT_DEFINITIONS.map((shortcut) => [shortcut.id, shortcut])
);

let settings: SettingsData = { ...DEFAULT_SETTINGS };

const focusManager = new FocusManager();
const shortcutsDialog = new ShortcutsDialogController();
const usageIndicator = new UsageIndicator();

function getBindings(id: ShortcutId): KeyBinding[] {
  const custom = settings.shortcuts[id];
  if (Array.isArray(custom) && custom.length) return custom;
  const def = shortcutMap.get(id);
  return def?.defaultBindings ?? [];
}

function matchesShortcut(id: ShortcutId, event: KeyboardEvent): boolean {
  const def = shortcutMap.get(id);
  if (!def) return false;
  if (!settings.featureToggles[def.category]) return false;
  return getBindings(id).some((binding) => bindingMatchesEvent(binding, event));
}

function handleScrollShortcut(event: KeyboardEvent, action: ScrollAction): boolean {
  return vimScrollController.handleShortcut(event, action);
}

function preventEvent(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (event.stopImmediatePropagation) event.stopImmediatePropagation();
}

function handleOtherShortcut(event: KeyboardEvent, id: ShortcutId): boolean {
  switch (id) {
    case 'toggleSidebar':
      preventEvent(event);
      toggleSidebarPin();
      return true;
    case 'openNewChat':
      preventEvent(event);
      void openNewChatViaSidebar();
      return true;
    case 'toggleIncognitoChat':
      preventEvent(event);
      void toggleIncognitoChat();
      return true;
    case 'deleteChat':
      preventEvent(event);
      void openDeleteModalAndFocusConfirm();
      return true;
    case 'bookmarkChat':
      preventEvent(event);
      void starCurrentChatViaMenu();
      return true;
    case 'copyLastMessage':
      preventEvent(event);
      copyLastUserMessageViaActionBar();
      return true;
    case 'toggleModel':
      preventEvent(event);
      toggleModelDropdown();
      return true;
    case 'selectHaiku':
      preventEvent(event);
      void selectModelByName('Haiku');
      return true;
    case 'selectSonnet':
      preventEvent(event);
      void selectModelByName('Sonnet');
      return true;
    case 'selectOpus':
      preventEvent(event);
      void selectModelByName('Opus');
      return true;
    default:
      return false;
  }
}

function handleRestrictedShortcuts(event: KeyboardEvent): boolean {
  const key = (event.key || '').toLowerCase();
  const inEditable = isKeyboardEventInEditableContext(event);

  if (isModKey(event) && !event.altKey && !event.shiftKey && key === 'k') {
    if (!inEditable) {
      preventEvent(event);
      return true;
    }
    return false;
  }

  if (isModKey(event) && !event.altKey && !event.shiftKey && key === '.') {
    preventEvent(event);
    return true;
  }

  if (!inEditable && !isModKey(event) && event.shiftKey && !event.altKey && key === 'i') {
    preventEvent(event);
    return true;
  }

  return false;
}

function isDialogActuallyOpen(dialog: HTMLElement): boolean {
  if (!dialog || !dialog.isConnected) return false;
  if (!document.body.contains(dialog)) return false;
  if (dialog.getAttribute('aria-hidden') === 'true') return false;
  if (dialog.hasAttribute('hidden')) return false;

  const state = dialog.dataset?.state ?? dialog.getAttribute('data-state') ?? '';
  if (state) {
    return state === 'open' || state === 'entered';
  }

  const rect = dialog.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  const style = window.getComputedStyle(dialog);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function handleShortcutDialogToggle(event: KeyboardEvent): boolean {
  const key = (event.key || '').toLowerCase();
  if (!(isModKey(event) && !event.altKey && !event.shiftKey && key === '/')) return false;

  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
  const openDialog =
    dialogs.find((dialog) => {
      if (!/keyboard shortcuts/i.test(dialog.textContent || '')) return false;
      return isDialogActuallyOpen(dialog);
    }) || null;
  if (openDialog) {
    preventEvent(event);
    const closeButton =
      openDialog.querySelector<HTMLElement>('button[aria-label="Close"]') ||
      openDialog.querySelector<HTMLElement>('button[data-testid="close"]');
    if (closeButton) {
      closeButton.click();
    } else {
      const escapeDown = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
      });
      const escapeUp = new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true });
      document.dispatchEvent(escapeDown);
      document.dispatchEvent(escapeUp);
    }
    return true;
  }

  return false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (handleShortcutDialogToggle(event)) return;

  if (settings.featureToggles.vimScroll) {
    if (matchesShortcut('scrollTop', event) && handleScrollShortcut(event, 'top')) return;
    if (matchesShortcut('scrollBottom', event) && handleScrollShortcut(event, 'bottom')) return;
    if (matchesShortcut('scrollHalfUp', event) && handleScrollShortcut(event, 'halfUp')) return;
    if (matchesShortcut('scrollHalfDown', event) && handleScrollShortcut(event, 'halfDown')) return;
    if (matchesShortcut('scrollUp', event) && handleScrollShortcut(event, 'up')) return;
    if (matchesShortcut('scrollDown', event) && handleScrollShortcut(event, 'down')) return;
  }

  if (settings.featureToggles.wideScreen && matchesShortcut('toggleFocus', event)) {
    preventEvent(event);
    focusManager.toggleFocus();
    return;
  }

  if (settings.featureToggles.otherShortcuts) {
    const otherIds: ShortcutId[] = [
      'toggleSidebar',
      'openNewChat',
      'toggleIncognitoChat',
      'deleteChat',
      'bookmarkChat',
      'copyLastMessage',
      'toggleModel',
      'selectHaiku',
      'selectSonnet',
      'selectOpus',
    ];

    for (const id of otherIds) {
      if (matchesShortcut(id, event)) {
        if (handleOtherShortcut(event, id)) {
          return;
        }
      }
    }
  }

  handleRestrictedShortcuts(event);
}

function handleKeyup(event: KeyboardEvent): void {
  vimScrollController.handleKeyup(event);
}

function applySettings(next: SettingsData): void {
  settings = mergeSettings(next);
  shortcutsDialog.updateSettings(settings);
  if (settings.featureToggles.wideScreen) {
    focusManager.enable();
    document.body.classList.add('cps-wide-screen-enabled');
  } else {
    focusManager.disable();
    document.body.classList.remove('cps-wide-screen-enabled');
  }
}

function setupListeners(): void {
  window.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('keyup', handleKeyup, true);
  shortcutsDialog.init();
  usageIndicator.enable();
}

function setupSettingsBridge(): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== MESSAGE_SOURCE) return;
    if (data.type === MESSAGE_TYPES.settings && data.payload) {
      applySettings(mergeSettings(data.payload as SettingsData));
    }
    if (data.type === MESSAGE_TYPES.i18n && data.payload) {
      window.__CPS_I18N__ = data.payload as Record<string, string>;
    }
  });

  window.postMessage(
    { source: MESSAGE_SOURCE, type: MESSAGE_TYPES.requestSettings },
    window.location.origin
  );
  window.postMessage(
    { source: MESSAGE_SOURCE, type: MESSAGE_TYPES.requestI18n },
    window.location.origin
  );
}

applySettings(settings);
setupListeners();
setupSettingsBridge();

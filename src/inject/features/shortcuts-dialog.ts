import { I18N_KEYS, type I18nKey } from '@/shared/i18n-keys';
import { bindingToDisplayTokens, isMacPlatform, isModKey } from '@/shared/keyboard';

import { MESSAGE_SOURCE, MESSAGE_TYPES } from '../../shared/messages';
import {
  DEFAULT_SETTINGS,
  SHORTCUT_DEFINITIONS,
  type KeyBinding,
  type SettingsData,
} from '../../shared/settings';
import { tp } from '../utils/i18n';

type ShortcutDefinitionWithCategory = (typeof SHORTCUT_DEFINITIONS)[number];

interface ShortcutRow {
  nameKey: I18nKey;
  fallbackName: string;
  bindings?: string[][];
  linkLabelKey?: I18nKey;
  fallbackLinkLabel?: string;
  onClick?: () => void;
}

const MOD_SYMBOL = isMacPlatform ? '⌘' : 'Ctrl';
const SHIFT_SYMBOL = isMacPlatform ? '⇧' : 'Shift';

const CLAUDE_DEFAULT_SHORTCUTS: ShortcutRow[] = [
  {
    nameKey: I18N_KEYS.dialogDefaultKeyboardShortcuts,
    fallbackName: 'Keyboard shortcuts',
    bindings: [[MOD_SYMBOL, '/']],
  },
  {
    nameKey: I18N_KEYS.dialogDefaultSettings,
    fallbackName: 'Settings',
    bindings: [[SHIFT_SYMBOL, MOD_SYMBOL, ',']],
  },
  {
    nameKey: I18N_KEYS.dialogDefaultToggleExtendedThinking,
    fallbackName: 'Toggle extended thinking',
    bindings: [[SHIFT_SYMBOL, MOD_SYMBOL, 'E']],
  },
  {
    nameKey: I18N_KEYS.dialogDefaultUploadFile,
    fallbackName: 'Upload file',
    bindings: [[MOD_SYMBOL, 'U']],
  },
  {
    nameKey: I18N_KEYS.dialogDefaultStopResponse,
    fallbackName: "Stop Claude's response",
    bindings: [['Esc']],
  },
];

const KEY_LABEL_MAP: Record<string, { i18nKey: I18nKey; fallback: string }> = {
  ' ': { i18nKey: I18N_KEYS.keySpace, fallback: 'Space' },
  Space: { i18nKey: I18N_KEYS.keySpace, fallback: 'Space' },
  Spacebar: { i18nKey: I18N_KEYS.keySpace, fallback: 'Space' },
  Enter: { i18nKey: I18N_KEYS.keyEnter, fallback: 'Enter' },
  Esc: { i18nKey: I18N_KEYS.keyEscape, fallback: 'Esc' },
  Escape: { i18nKey: I18N_KEYS.keyEscape, fallback: 'Esc' },
};

const KEY_SYMBOL_MAP: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  Delete: '⌦',
};

function formatKeyLabel(key?: string): string {
  if (!key) return '';

  const localized = KEY_LABEL_MAP[key];
  if (localized) {
    return tp(localized.i18nKey, localized.fallback);
  }

  if (KEY_SYMBOL_MAP[key]) {
    return KEY_SYMBOL_MAP[key];
  }

  if (key.length === 1) return key.toUpperCase();
  return key;
}

function bindingToTokens(binding: KeyBinding): string[] {
  return bindingToDisplayTokens(binding, { useSymbols: true, formatKey: formatKeyLabel });
}

function filterDeleteBindingsForDisplay(bindings: KeyBinding[]): KeyBinding[] {
  // Requirement: show a single Delete Chat pattern per OS
  const preferBackspace = bindings.filter((b) => {
    const key = (b.key || '').toLowerCase();
    const code = (b.code || '').toLowerCase();
    return key === 'backspace' || code === 'backspace';
  });

  if (preferBackspace.length) {
    return preferBackspace;
  }

  // Fallback: return the original array for safety if definitions change
  return bindings;
}

function createShortcutElement(item: ShortcutRow): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'last:border-0 flex items-center justify-between py-2 border-b border-bg-300';
  row.setAttribute('data-cps-shortcut-row', 'true');

  const nameSpan = document.createElement('span');
  nameSpan.textContent = tp(item.nameKey, item.fallbackName);
  row.appendChild(nameSpan);

  const keysContainer = document.createElement('div');
  keysContainer.className = 'flex items-center gap-1';

  if (item.linkLabelKey) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = tp(item.linkLabelKey, item.fallbackLinkLabel ?? '');
    link.className = 'underline';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      item.onClick?.();
    });
    keysContainer.appendChild(link);
  } else if (item.bindings) {
    item.bindings.forEach((bindingTokens, index) => {
      if (!bindingTokens.length) return;
      if (index > 0) {
        const sep = document.createElement('span');
        sep.className = 'text-text-400 px-1';
        sep.textContent = '/';
        keysContainer.appendChild(sep);
      }

      bindingTokens.forEach((key) => {
        const kbd = document.createElement('kbd');
        kbd.className =
          'font-base select-none inline-flex items-center justify-center rounded h-7 min-w-[28px] px-2 border border-bg-300 bg-bg-100 text-text-500 text-sm';
        kbd.textContent = key;
        keysContainer.appendChild(kbd);
      });
    });
  }

  row.appendChild(keysContainer);
  return row;
}

function createSection(
  title: string,
  shortcuts: ShortcutRow[],
  isFirst: boolean = false
): HTMLDivElement {
  const sectionDiv = document.createElement('div');
  sectionDiv.setAttribute('data-cps-section', 'true');

  const titleDiv = document.createElement('div');
  titleDiv.className = `font-base font-semibold mb-2 ${isFirst ? '' : 'mt-4'}`.trim();
  titleDiv.textContent = title;
  sectionDiv.appendChild(titleDiv);

  shortcuts.forEach((item) => {
    sectionDiv.appendChild(createShortcutElement(item));
  });

  return sectionDiv;
}

export class ShortcutsDialogController {
  private settings: SettingsData = { ...DEFAULT_SETTINGS };
  private observer: MutationObserver | null = null;
  private dialogWatchTimeoutId: number | null = null;
  private currentDialog: HTMLElement | null = null;
  private sectionsContainer: HTMLElement | null = null;

  public init(): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => this.handleNodeAdded(node));
        mutation.removedNodes.forEach((node) => this.handleNodeRemoved(node));
      });
    });

    this.startDialogWatch();

    document.addEventListener(
      'keydown',
      (event) => {
        if (this.isToggleShortcut(event)) {
          this.startDialogWatch();
        }
        if (!this.isToggleShortcut(event)) return;
        if (!this.currentDialog || !this.isDialogOpen(this.currentDialog)) {
          this.currentDialog = null;
          this.sectionsContainer = null;
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.closeCurrentDialog();
      },
      true
    );
  }

  public updateSettings(next: SettingsData): void {
    this.settings = {
      featureToggles: { ...next.featureToggles },
      shortcuts: { ...next.shortcuts },
    };

    if (this.currentDialog) {
      this.renderDialog(this.currentDialog);
    }
  }

  private handleNodeAdded(node: Node): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const dialog = this.extractDialog(element);
    if (!dialog) return;
    if (!this.isKeyboardShortcutDialog(dialog)) return;
    this.currentDialog = dialog;
    window.setTimeout(() => {
      if (!this.isDialogOpen(dialog)) {
        if (this.currentDialog === dialog) {
          this.currentDialog = null;
          this.sectionsContainer = null;
        }
        return;
      }
      this.renderDialog(dialog);
    }, 100);
    this.scheduleStopDialogWatch();
  }

  private handleNodeRemoved(node: Node): void {
    if (!this.currentDialog) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (element === this.currentDialog || element.contains(this.currentDialog)) {
      this.currentDialog = null;
      this.sectionsContainer = null;
    }
    this.scheduleStopDialogWatch();
  }

  private extractDialog(element: HTMLElement): HTMLElement | null {
    if (element.getAttribute('role') === 'dialog') {
      return element;
    }
    return element.querySelector<HTMLElement>('[role="dialog"]');
  }

  private isKeyboardShortcutDialog(dialog: HTMLElement): boolean {
    const text = dialog.textContent || '';
    return /keyboard shortcuts/i.test(text);
  }

  private isDialogOpen(dialog: HTMLElement): boolean {
    if (!dialog || !dialog.isConnected) return false;
    if (!document.body.contains(dialog)) return false;
    if (dialog.getAttribute('aria-hidden') === 'true') return false;
    if (dialog.hasAttribute('hidden')) return false;

    const state = dialog.dataset.state ?? dialog.getAttribute('data-state') ?? '';
    if (state) {
      return state === 'open' || state === 'entered';
    }

    const rect = dialog.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    const style = window.getComputedStyle(dialog);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  private scanForDialog(): void {
    const existing = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!existing) return;
    if (!this.isKeyboardShortcutDialog(existing)) return;
    if (!this.isDialogOpen(existing)) return;
    this.currentDialog = existing;
    window.setTimeout(() => this.renderDialog(existing), 100);
  }

  private startDialogWatch(): void {
    if (!this.observer) return;
    this.scanForDialog();
    this.observer.disconnect();
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.scheduleStopDialogWatch();
  }

  private stopDialogWatch(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.dialogWatchTimeoutId !== null) {
      window.clearTimeout(this.dialogWatchTimeoutId);
      this.dialogWatchTimeoutId = null;
    }
  }

  private scheduleStopDialogWatch(): void {
    if (this.dialogWatchTimeoutId !== null) {
      window.clearTimeout(this.dialogWatchTimeoutId);
      this.dialogWatchTimeoutId = null;
    }
    if (this.currentDialog && !this.isDialogOpen(this.currentDialog)) {
      this.currentDialog = null;
      this.sectionsContainer = null;
    }
    if (this.currentDialog && this.isDialogOpen(this.currentDialog)) {
      return;
    }
    this.dialogWatchTimeoutId = window.setTimeout(() => this.stopDialogWatch(), 5000);
  }

  private renderDialog(dialog: HTMLElement): void {
    const container = this.getSectionsContainer(dialog);
    if (!container) return;

    container.innerHTML = '';

    const claudeSection = createSection(
      tp(I18N_KEYS.dialogSectionClaudeDefaults, 'Claude Defaults'),
      CLAUDE_DEFAULT_SHORTCUTS,
      true
    );
    container.appendChild(claudeSection);

    const extensionShortcuts = this.getExtensionRows();
    if (extensionShortcuts.length) {
      const extensionSection = createSection(
        tp(I18N_KEYS.dialogSectionExtension, 'Extension'),
        extensionShortcuts
      );
      container.appendChild(extensionSection);
    }
  }

  private getExtensionRows(): ShortcutRow[] {
    const rows: ShortcutRow[] = [
      {
        nameKey: I18N_KEYS.dialogSettingShortcutKey,
        fallbackName: 'Setting Shortcut Key',
        linkLabelKey: I18N_KEYS.dialogLinkClickHere,
        fallbackLinkLabel: 'Click Here',
        onClick: () => this.openSettings(),
      },
    ];

    SHORTCUT_DEFINITIONS.forEach((def) => {
      if (!this.settings.featureToggles[def.category]) {
        return;
      }

      let bindings = this.getBindings(def);
      if (!bindings.length) return;

      if (def.id === 'deleteChat') {
        bindings = filterDeleteBindingsForDisplay(bindings);
      }

      rows.push({
        nameKey: def.labelKey,
        fallbackName: def.defaultLabel,
        bindings: bindings.map((binding) => bindingToTokens(binding)),
      });
    });

    return rows;
  }

  private getBindings(def: ShortcutDefinitionWithCategory): KeyBinding[] {
    const stored = this.settings.shortcuts[def.id];
    if (Array.isArray(stored) && stored.length) {
      return stored;
    }
    return def.defaultBindings;
  }

  private isToggleShortcut(event: KeyboardEvent): boolean {
    const key = (event.key || '').toLowerCase();
    return isModKey(event) && !event.altKey && !event.shiftKey && key === '/';
  }

  private closeCurrentDialog(): void {
    const dialog = this.currentDialog;
    if (!dialog) return;

    const closeButton =
      dialog.querySelector<HTMLElement>('button[aria-label="Close"]') ||
      dialog.querySelector<HTMLElement>('button[data-testid="close"]');

    if (closeButton) {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return;
    }

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escapeEvent);
  }

  private openSettings(): void {
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: MESSAGE_TYPES.openSettings,
      },
      window.location.origin
    );
  }

  private getSectionsContainer(dialog: HTMLElement): HTMLElement | null {
    if (this.sectionsContainer && dialog.contains(this.sectionsContainer)) {
      return this.sectionsContainer;
    }

    const headers = Array.from(dialog.querySelectorAll<HTMLElement>('.font-base.font-semibold'));
    const generalHeader = headers.find((el) => el.textContent?.includes('General'));
    if (!generalHeader) return null;

    const container = generalHeader.parentElement?.parentElement ?? null;
    if (container) {
      container.dataset.cpsShortcutsContainer = 'true';
      this.sectionsContainer = container;
    }
    return container;
  }
}

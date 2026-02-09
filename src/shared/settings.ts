import { I18N_KEYS, type I18nKey } from './i18n-keys';
import { isWindowsPlatform, normalizeModifiers } from './keyboard';

export type FeatureToggleKey = 'vimScroll' | 'wideScreen' | 'safeSend' | 'otherShortcuts';

export interface KeyBinding {
  key: string;
  code: string;
  mod?: boolean;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

interface LabeledMessage {
  labelKey: I18nKey;
  defaultLabel: string;
}

export interface ShortcutDefinition extends LabeledMessage {
  id:
    | 'scrollTop'
    | 'scrollBottom'
    | 'scrollUp'
    | 'scrollDown'
    | 'scrollHalfUp'
    | 'scrollHalfDown'
    | 'toggleFocus'
    | 'toggleSidebar'
    | 'openNewChat'
    | 'toggleIncognitoChat'
    | 'deleteChat'
    | 'bookmarkChat'
    | 'toggleModel'
    | 'selectHaiku'
    | 'selectSonnet'
    | 'selectOpus';
  category: FeatureToggleKey;
  defaultBindings: KeyBinding[];
}

export type ShortcutId = ShortcutDefinition['id'];

export interface SettingsData {
  featureToggles: Record<FeatureToggleKey, boolean>;
  shortcuts: Record<ShortcutId, KeyBinding[]>;
}

export const FEATURE_TOGGLE_DEFINITIONS: Record<FeatureToggleKey, LabeledMessage> = {
  vimScroll: {
    labelKey: I18N_KEYS.featureToggleVimScroll,
    defaultLabel: 'Vim-like Scroll',
  },
  wideScreen: {
    labelKey: I18N_KEYS.featureToggleWideScreen,
    defaultLabel: 'Wide Screen / Focus',
  },
  safeSend: {
    labelKey: I18N_KEYS.featureToggleSafeSend,
    defaultLabel: 'Send with Cmd/Ctrl + Enter',
  },
  otherShortcuts: {
    labelKey: I18N_KEYS.featureToggleOtherShortcuts,
    defaultLabel: 'Other Shortcuts',
  },
};

export const DEFAULT_FEATURE_TOGGLES: Record<FeatureToggleKey, boolean> = {
  vimScroll: true,
  wideScreen: true,
  safeSend: true,
  otherShortcuts: true,
};

const HAIKU_NON_WINDOWS_DEFAULT_BINDING: KeyBinding = {
  key: '0',
  code: 'Digit0',
  mod: true,
  shift: true,
};

const HAIKU_WINDOWS_DEFAULT_BINDING: KeyBinding = {
  key: '7',
  code: 'Digit7',
  mod: true,
  shift: true,
};

const DEFAULT_HAIKU_BINDINGS: KeyBinding[] = [
  isWindowsPlatform ? HAIKU_WINDOWS_DEFAULT_BINDING : HAIKU_NON_WINDOWS_DEFAULT_BINDING,
];

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'scrollTop',
    labelKey: I18N_KEYS.shortcutScrollTop,
    defaultLabel: 'Scroll to Top',
    category: 'vimScroll',
    defaultBindings: [{ key: 'k', code: 'KeyK', mod: true }],
  },
  {
    id: 'scrollBottom',
    labelKey: I18N_KEYS.shortcutScrollBottom,
    defaultLabel: 'Scroll to Bottom',
    category: 'vimScroll',
    defaultBindings: [{ key: 'j', code: 'KeyJ', mod: true }],
  },
  {
    id: 'scrollUp',
    labelKey: I18N_KEYS.shortcutScrollUp,
    defaultLabel: 'Scroll Up',
    category: 'vimScroll',
    defaultBindings: [{ key: 'k', code: 'KeyK' }],
  },
  {
    id: 'scrollDown',
    labelKey: I18N_KEYS.shortcutScrollDown,
    defaultLabel: 'Scroll Down',
    category: 'vimScroll',
    defaultBindings: [{ key: 'j', code: 'KeyJ' }],
  },
  {
    id: 'scrollHalfUp',
    labelKey: I18N_KEYS.shortcutScrollHalfUp,
    defaultLabel: 'Scroll Half Page Up',
    category: 'vimScroll',
    defaultBindings: [{ key: 'K', code: 'KeyK', shift: true }],
  },
  {
    id: 'scrollHalfDown',
    labelKey: I18N_KEYS.shortcutScrollHalfDown,
    defaultLabel: 'Scroll Half Page Down',
    category: 'vimScroll',
    defaultBindings: [{ key: 'J', code: 'KeyJ', shift: true }],
  },
  {
    id: 'toggleFocus',
    labelKey: I18N_KEYS.shortcutToggleFocus,
    defaultLabel: 'Toggle Focus',
    category: 'wideScreen',
    defaultBindings: [{ key: ' ', code: 'Space', shift: true }],
  },
  {
    id: 'toggleSidebar',
    labelKey: I18N_KEYS.shortcutToggleSidebar,
    defaultLabel: 'Toggle Side Bar',
    category: 'otherShortcuts',
    defaultBindings: [{ key: 'S', code: 'KeyS', mod: true, shift: true }],
  },
  {
    id: 'openNewChat',
    labelKey: I18N_KEYS.shortcutOpenNewChat,
    defaultLabel: 'Open New Chat',
    category: 'otherShortcuts',
    defaultBindings: [{ key: 'O', code: 'KeyO', mod: true, shift: true }],
  },
  {
    id: 'toggleIncognitoChat',
    labelKey: I18N_KEYS.shortcutToggleIncognitoChat,
    defaultLabel: 'Incognito Chat',
    category: 'otherShortcuts',
    defaultBindings: [{ key: 'i', code: 'KeyI', mod: true }],
  },
  {
    id: 'deleteChat',
    labelKey: I18N_KEYS.shortcutDeleteChat,
    defaultLabel: 'Delete Chat',
    category: 'otherShortcuts',
    defaultBindings: [
      { key: 'Delete', code: 'Delete', mod: true, shift: true },
      { key: 'Backspace', code: 'Backspace', mod: true, shift: true },
    ],
  },
  {
    id: 'bookmarkChat',
    labelKey: I18N_KEYS.shortcutBookmarkChat,
    defaultLabel: 'Star Chat',
    category: 'otherShortcuts',
    defaultBindings: [{ key: 'P', code: 'KeyP', mod: true, shift: true }],
  },
  {
    id: 'toggleModel',
    labelKey: I18N_KEYS.shortcutToggleModel,
    defaultLabel: 'Toggle Model',
    category: 'otherShortcuts',
    defaultBindings: [{ key: 'ArrowDown', code: 'ArrowDown', mod: true, shift: true }],
  },
  {
    id: 'selectHaiku',
    labelKey: I18N_KEYS.shortcutSelectHaiku,
    defaultLabel: 'Haiku',
    category: 'otherShortcuts',
    defaultBindings: DEFAULT_HAIKU_BINDINGS,
  },
  {
    id: 'selectSonnet',
    labelKey: I18N_KEYS.shortcutSelectSonnet,
    defaultLabel: 'Sonnet',
    category: 'otherShortcuts',
    defaultBindings: [{ key: '8', code: 'Digit8', mod: true, shift: true }],
  },
  {
    id: 'selectOpus',
    labelKey: I18N_KEYS.shortcutSelectOpus,
    defaultLabel: 'Opus',
    category: 'otherShortcuts',
    defaultBindings: [{ key: '9', code: 'Digit9', mod: true, shift: true }],
  },
];

export const DEFAULT_SHORTCUTS: Record<ShortcutId, KeyBinding[]> = SHORTCUT_DEFINITIONS.reduce(
  (acc, shortcut) => {
    acc[shortcut.id] = shortcut.defaultBindings;
    return acc;
  },
  {} as Record<ShortcutId, KeyBinding[]>
);

export const DEFAULT_SETTINGS: SettingsData = {
  featureToggles: { ...DEFAULT_FEATURE_TOGGLES },
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

export const STORAGE_KEY = 'claudePowerSuiteSettings';

function isSameBinding(a: KeyBinding, b: KeyBinding): boolean {
  const modsA = normalizeModifiers(a);
  const modsB = normalizeModifiers(b);
  const modifiersMatch =
    modsA.mod === modsB.mod &&
    modsA.ctrl === modsB.ctrl &&
    modsA.meta === modsB.meta &&
    modsA.shift === modsB.shift &&
    modsA.alt === modsB.alt;
  const keyMatch = a.key.toLowerCase() === b.key.toLowerCase();
  const codeMatch = a.code && b.code ? a.code === b.code : false;
  return modifiersMatch && (keyMatch || codeMatch);
}

function isLegacyHaikuBinding(bindings: KeyBinding[] | undefined): boolean {
  if (!Array.isArray(bindings) || bindings.length !== 1) return false;
  return isSameBinding(bindings[0], HAIKU_NON_WINDOWS_DEFAULT_BINDING);
}

export function mergeSettings(partial: Partial<SettingsData> | undefined | null): SettingsData {
  const featureToggles = { ...DEFAULT_FEATURE_TOGGLES, ...(partial?.featureToggles ?? {}) };
  const shortcuts: Record<ShortcutId, KeyBinding[]> = { ...DEFAULT_SHORTCUTS };

  if (partial?.shortcuts) {
    for (const [id, bindings] of Object.entries(partial.shortcuts)) {
      if (!Array.isArray(bindings)) continue;
      const shortcutId = id as ShortcutId;
      shortcuts[shortcutId] = bindings.length ? bindings : DEFAULT_SHORTCUTS[shortcutId];
    }
  }

  if (isWindowsPlatform && isLegacyHaikuBinding(shortcuts.selectHaiku)) {
    shortcuts.selectHaiku = DEFAULT_SHORTCUTS.selectHaiku;
  }

  return { featureToggles, shortcuts };
}

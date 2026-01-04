import { type KeyBinding } from './settings';

const platform =
  typeof navigator !== 'undefined' && typeof navigator.platform === 'string'
    ? navigator.platform.toLowerCase()
    : '';

export const isMacPlatform = platform.includes('mac');
export const isWindowsPlatform = platform.startsWith('win');

export function isModKey(event: { metaKey?: boolean; ctrlKey?: boolean }): boolean {
  return isMacPlatform ? !!event.metaKey : !!event.ctrlKey;
}

type ModifierLabels = {
  mod: string;
  ctrl: string;
  meta: string;
  alt: string;
  shift: string;
};

function getModifierLabels(useSymbols: boolean): ModifierLabels {
  return {
    mod: isMacPlatform ? (useSymbols ? '⌘' : 'Cmd') : 'Ctrl',
    ctrl: 'Ctrl',
    meta: isMacPlatform ? (useSymbols ? '⌘' : 'Cmd') : 'Meta',
    alt: isMacPlatform ? (useSymbols ? '⌥' : 'Option') : 'Alt',
    shift: useSymbols && isMacPlatform ? '⇧' : 'Shift',
  };
}

export function normalizeModifiers(binding: KeyBinding): {
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
} {
  const mod = binding.mod ?? binding.meta ?? false;
  return {
    mod,
    ctrl: mod ? false : !!binding.ctrl,
    meta: mod ? false : !!binding.meta,
    alt: !!binding.alt,
    shift: !!binding.shift,
  };
}

export function modifiersMatch(binding: KeyBinding, event: KeyboardEvent): boolean {
  const normalized = normalizeModifiers(binding);
  const modActive = isModKey(event);

  if (normalized.mod) {
    if (!modActive) return false;
  } else if (!normalized.meta && !normalized.ctrl && modActive) {
    return false;
  }

  if (!normalized.mod) {
    if (normalized.ctrl !== event.ctrlKey) return false;
    if (normalized.meta !== event.metaKey) return false;
  }

  if (normalized.alt !== event.altKey) return false;
  if (normalized.shift !== event.shiftKey) return false;

  return true;
}

const SPACE_KEYS = new Set([' ', 'space', 'spacebar']);

function codeToKeyName(code: string | undefined): string | null {
  if (!code) return null;

  if (code.startsWith('Key') && code.length === 4) {
    const letter = code.slice(3);
    if (/^[a-z]$/i.test(letter)) return letter.toUpperCase();
  }

  if (code.startsWith('Digit') && code.length === 6) {
    const digit = code.slice(5);
    if (/^[0-9]$/.test(digit)) return digit;
  }

  return null;
}

export function defaultFormatKey(key: string | undefined): string {
  if (!key) return '';
  const normalized = key.toLowerCase();
  if (SPACE_KEYS.has(normalized)) return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function bindingMatchesEvent(binding: KeyBinding, event: KeyboardEvent): boolean {
  if (!modifiersMatch(binding, event)) return false;

  const keyMatch = (event.key || '').toLowerCase() === (binding.key || '').toLowerCase();
  const codeMatch = binding.code ? binding.code === event.code : false;
  return keyMatch || codeMatch;
}

export function bindingToDisplayTokens(
  binding: KeyBinding,
  options?: { useSymbols?: boolean; formatKey?: (key: string | undefined) => string }
): string[] {
  const normalized = normalizeModifiers(binding);
  const useSymbols = options?.useSymbols ?? isMacPlatform;
  const labels = getModifierLabels(useSymbols);
  const tokens: string[] = [];

  if (normalized.mod) {
    tokens.push(labels.mod);
  } else {
    if (normalized.meta) tokens.push(labels.meta);
    if (normalized.ctrl) tokens.push(labels.ctrl);
  }

  if (normalized.alt) tokens.push(labels.alt);
  if (normalized.shift) tokens.push(labels.shift);

  const formatKey = options?.formatKey ?? defaultFormatKey;
  const keyForDisplay =
    isMacPlatform && normalized.alt ? (codeToKeyName(binding.code) ?? binding.key) : binding.key;
  const keyLabel = formatKey(keyForDisplay);
  if (keyLabel) tokens.push(keyLabel);

  return tokens;
}

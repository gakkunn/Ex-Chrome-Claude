import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { t } from '@/shared/i18n';
import { I18N_KEYS } from '@/shared/i18n-keys';
import {
  bindingToDisplayTokens,
  isMacPlatform,
  isModKey,
  normalizeModifiers,
} from '@/shared/keyboard';
import {
  DEFAULT_FEATURE_TOGGLES,
  DEFAULT_SHORTCUTS,
  FEATURE_TOGGLE_DEFINITIONS,
  SHORTCUT_DEFINITIONS,
  mergeSettings,
  type FeatureToggleKey,
  type KeyBinding,
  type SettingsData,
  type ShortcutDefinition,
  type ShortcutId,
} from '@/shared/settings';
import { loadSettings, saveSettings } from '@/shared/storage';

type MessageState = {
  text: string;
  type: 'info' | 'error';
} | null;

const initialSettings: SettingsData = {
  featureToggles: { ...DEFAULT_FEATURE_TOGGLES },
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

const GITHUB_URL = 'https://github.com/gakkunn/Ex-Chrome-Claude';
const SUPPORT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScTb5N21gzjuGKWrSeoNwy7HZdcSmU9kKJGnJ-PMHwla8sHGA/viewform';
const COFFEE_URL = 'https://buymeacoffee.com/gakkunn';

const ICON_GITHUB_SRC = '/img/github.svg';
const ICON_SUPPORT_SRC = '/img/support.svg';
const ICON_COFFEE_SRC = '/img/coffee.svg';

const formatKey = (key?: string): string => {
  if (!key) return '';
  const lower = key.toLowerCase();
  if (key === ' ' || lower === 'space' || lower === 'spacebar') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
};

const bindingToText = (binding: KeyBinding): string => {
  const tokens = bindingToDisplayTokens(binding, { formatKey });
  return tokens.join(' + ');
};

const filterDeleteBindingsForDisplay = (bindings: KeyBinding[]): KeyBinding[] => {
  const preferBackspace = bindings.filter((b) => {
    const key = (b.key || '').toLowerCase();
    const code = (b.code || '').toLowerCase();
    return key === 'backspace' || code === 'backspace';
  });
  return preferBackspace.length ? preferBackspace : bindings;
};

const captureBinding = (event: {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): KeyBinding | null => {
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
    return null;
  }

  const key = event.key === 'Spacebar' ? ' ' : event.key;
  return {
    key,
    code: event.code,
    mod: isModKey(event),
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  };
};

type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'requiresModifier' | 'forbidden';
    };

const SINGLE_KEY_REQUIRE_MOD = new Set(['Escape', 'Esc', 'Backspace', 'Delete']);
const SINGLE_CODE_REQUIRE_MOD = new Set(['Escape', 'Backspace', 'Delete']);

const FORBIDDEN_KEYS = new Set([
  'Enter',
  'Return',
  'Tab',
  // IME / input mode keys
  'Eisu',
  'Alphanumeric',
  'KanaMode',
  'Zenkaku',
  'Hankaku',
  'HankakuZenkaku',
  'Henkan',
  'NonConvert',
  'Kana',
  'Kanji',
  'Katakana',
  'Hiragana',
  'Romaji',
  'Lang1',
  'Lang2',
  'Lang3',
  'Lang4',
  'Lang5',
  // Lock keys
  'CapsLock',
  'NumLock',
  'ScrollLock',
]);

const FORBIDDEN_CODES = new Set([
  'Enter',
  'NumpadEnter',
  'Tab',
  // IME / input mode keys
  'Eisu',
  'NonConvert',
  'Convert',
  'KanaMode',
  'Lang1',
  'Lang2',
  'Lang3',
  'Lang4',
  'Lang5',
  // Lock keys
  'CapsLock',
  'NumLock',
  'ScrollLock',
]);

const WINDOWS_KEY_NAMES = new Set(['meta', 'os', 'win', 'super']);
const WINDOWS_KEY_CODES = new Set(['MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']);

const requiresModifierOnlyKey = (binding: KeyBinding): boolean => {
  const normalized = normalizeModifiers(binding);
  const unmodified =
    !normalized.meta && !normalized.ctrl && !normalized.shift && !normalized.alt && !normalized.mod;
  const keyMatch = SINGLE_KEY_REQUIRE_MOD.has(binding.key);
  const codeMatch = binding.code ? SINGLE_CODE_REQUIRE_MOD.has(binding.code) : false;
  return unmodified && (keyMatch || codeMatch);
};

const usesWindowsKey = (binding: KeyBinding): boolean => {
  const keyLower = (binding.key || '').toLowerCase();
  const keyMatch = WINDOWS_KEY_NAMES.has(keyLower);
  const codeMatch = binding.code ? WINDOWS_KEY_CODES.has(binding.code) : false;
  const normalized = normalizeModifiers(binding);
  const metaOnWindows = !isMacPlatform && normalized.meta;
  return keyMatch || codeMatch || metaOnWindows;
};

const isForbiddenBinding = (binding: KeyBinding): boolean => {
  const keyMatch = FORBIDDEN_KEYS.has(binding.key);
  const codeMatch = binding.code ? FORBIDDEN_CODES.has(binding.code) : false;
  if (keyMatch || codeMatch) return true;
  return usesWindowsKey(binding);
};

const validateBinding = (binding: KeyBinding): ValidationResult => {
  if (isForbiddenBinding(binding)) {
    return { ok: false, reason: 'forbidden' };
  }

  if (requiresModifierOnlyKey(binding)) {
    return { ok: false, reason: 'requiresModifier' };
  }

  return { ok: true };
};

const getBindings = (settings: SettingsData, def: ShortcutDefinition): KeyBinding[] => {
  const stored = settings.shortcuts[def.id];
  const source = Array.isArray(stored) && stored.length ? stored : def.defaultBindings;

  if (def.id === 'deleteChat') {
    return filterDeleteBindingsForDisplay(source);
  }

  return source;
};

const isSameBinding = (a: KeyBinding, b: KeyBinding): boolean => {
  const modsA = normalizeModifiers(a);
  const modsB = normalizeModifiers(b);
  const modifiersMatch =
    modsA.mod === modsB.mod &&
    modsA.meta === modsB.meta &&
    modsA.ctrl === modsB.ctrl &&
    modsA.shift === modsB.shift &&
    modsA.alt === modsB.alt;
  const keyMatch = a.key.toLowerCase() === b.key.toLowerCase();
  const codeMatch = a.code && b.code ? a.code === b.code : false;
  return modifiersMatch && (keyMatch || codeMatch);
};

type ShortcutInputProps = {
  bindings: KeyBinding[];
  label: string;
  onUpdate(binding: KeyBinding): Promise<boolean>;
};

const renderBindingKeycaps = (bindings: KeyBinding[]): JSX.Element[] => {
  const elements: JSX.Element[] = [];

  bindings.forEach((binding, bindingIndex) => {
    const tokens = bindingToDisplayTokens(binding, { formatKey });
    elements.push(
      <div className="shortcut-keycap-group" key={`${binding.code || binding.key}-${bindingIndex}`}>
        {tokens.map((token, tokenIndex) => (
          <span className="shortcut-keycap-wrapper" key={`${token}-${tokenIndex}`}>
            <kbd className="chatgpt-unified-keycap">
              <span className="chatgpt-unified-keycap-label">{token}</span>
            </kbd>
            {!isMacPlatform && tokenIndex < tokens.length - 1 && (
              <span className="chatgpt-unified-keycap-sep">+</span>
            )}
          </span>
        ))}
      </div>
    );

    if (bindingIndex < bindings.length - 1) {
      elements.push(
        <span
          className="shortcut-binding-sep"
          key={`sep-${binding.code || binding.key}-${bindingIndex}`}
        >
          /
        </span>
      );
    }
  });

  return elements;
};

const ShortcutInput = ({ bindings, label, onUpdate }: ShortcutInputProps) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [bindings]);

  const handleKeyDown = async (event: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const binding = captureBinding(event);
    if (!binding) return;

    setHasError(false);
    const success = await onUpdate(binding);
    if (!success) {
      setHasError(true);
    }
  };

  return (
    <div
      className={`shortcut-input${hasError ? ' shortcut-input-error' : ''}`}
      role="textbox"
      tabIndex={0}
      aria-label={t(I18N_KEYS.popupAriaShortcutInput, [label], `Shortcut for ${label}`)}
      onKeyDown={handleKeyDown}
      onClick={(event) => event.currentTarget.focus()}
    >
      <div className="shortcut-keycaps">
        {bindings.length ? (
          renderBindingKeycaps(bindings)
        ) : (
          <span className="shortcut-placeholder">
            {t(I18N_KEYS.popupPlaceholderPressKeys, undefined, 'Press keys')}
          </span>
        )}
      </div>
    </div>
  );
};

const getFeatureLabel = (key: FeatureToggleKey): string => {
  const def = FEATURE_TOGGLE_DEFINITIONS[key];
  return t(def.labelKey, undefined, def.defaultLabel);
};

const getShortcutLabel = (definition: ShortcutDefinition): string => {
  return t(definition.labelKey, undefined, definition.defaultLabel);
};

export function App() {
  const [settings, setSettings] = useState<SettingsData>(initialSettings);
  const [message, setMessage] = useState<MessageState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings()
      .then((loaded) => {
        setSettings(mergeSettings(loaded));
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(
    async (update: Partial<SettingsData>) => {
      const next = mergeSettings({ ...settings, ...update });
      setSettings(next);
      await saveSettings(next);
    },
    [settings]
  );

  const findConflict = useCallback(
    (binding: KeyBinding, targetId: ShortcutId): ShortcutDefinition | null => {
      const enabled = SHORTCUT_DEFINITIONS.filter((item) => settings.featureToggles[item.category]);
      for (const item of enabled) {
        if (item.id === targetId) continue;
        const bindings = getBindings(settings, item);
        if (bindings.some((stored) => isSameBinding(stored, binding))) {
          return item;
        }
      }
      return null;
    },
    [settings]
  );

  const handleShortcutUpdate = useCallback(
    async (definition: ShortcutDefinition, binding: KeyBinding) => {
      setMessage(null);
      const bindingText = bindingToText(binding);

      const validation = validateBinding(binding);
      if (!validation.ok) {
        const text = t(
          validation.reason === 'requiresModifier'
            ? I18N_KEYS.errorShortcutRequiresModifier
            : I18N_KEYS.errorShortcutForbiddenKey,
          [bindingText],
          validation.reason === 'requiresModifier'
            ? `"${bindingText}" must be combined with a modifier key.`
            : `"${bindingText}" cannot be used as a shortcut.`
        );
        setMessage({ text, type: 'error' });
        return false;
      }

      const conflict = findConflict(binding, definition.id);
      if (conflict) {
        const conflictLabel = getShortcutLabel(conflict);
        setMessage({
          text: t(
            I18N_KEYS.popupErrorShortcutConflict,
            [bindingText, conflictLabel],
            `"${bindingText}" is already assigned to "${conflictLabel}".`
          ),
          type: 'error',
        });
        return false;
      }

      await persist({
        shortcuts: {
          ...settings.shortcuts,
          [definition.id]: [binding],
        },
      });
      return true;
    },
    [findConflict, persist, settings.shortcuts]
  );

  const handleToggle = useCallback(
    async (id: FeatureToggleKey, checked: boolean) => {
      setMessage(null);
      await persist({
        featureToggles: {
          ...settings.featureToggles,
          [id]: checked,
        },
      });
    },
    [persist, settings.featureToggles]
  );

  const handleReset = useCallback(async () => {
    setMessage(null);
    await persist({
      featureToggles: { ...DEFAULT_FEATURE_TOGGLES },
      shortcuts: { ...DEFAULT_SHORTCUTS },
    });
  }, [persist]);

  const enabledShortcuts = useMemo(
    () => SHORTCUT_DEFINITIONS.filter((item) => settings.featureToggles[item.category]),
    [settings.featureToggles]
  );

  return (
    <div className="popup-wrapper">
      <header className="header-row">
        <div>
          <h1>{t(I18N_KEYS.popupTitle, undefined, 'Claude Shortcut Extension')}</h1>
        </div>
        <button
          className="reset-button"
          id="reset-button"
          type="button"
          onClick={() => void handleReset()}
          disabled={loading}
        >
          {t(I18N_KEYS.popupButtonReset, undefined, 'Reset')}
        </button>
      </header>

      <section className="card">
        <h2>{t(I18N_KEYS.popupSectionFeatures, undefined, 'Features')}</h2>
        <div className="toggle-list">
          {Object.entries(FEATURE_TOGGLE_DEFINITIONS).map(([id]) => (
            <label className="toggle" key={id}>
              <input
                type="checkbox"
                checked={!!settings.featureToggles[id as keyof typeof FEATURE_TOGGLE_DEFINITIONS]}
                onChange={(event) =>
                  void handleToggle(id as FeatureToggleKey, event.currentTarget.checked)
                }
                disabled={loading}
              />
              <span>{getFeatureLabel(id as FeatureToggleKey)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{t(I18N_KEYS.popupSectionShortcuts, undefined, 'Shortcuts')}</h2>
        <div className="shortcut-message" data-status={message?.type ?? ''} aria-live="polite">
          {message?.text}
        </div>
        {enabledShortcuts.map((definition) => {
          const label = getShortcutLabel(definition);
          return (
            <div className="shortcut-row" key={definition.id}>
              <div className="shortcut-label">{label}</div>
              <ShortcutInput
                label={label}
                bindings={getBindings(settings, definition)}
                onUpdate={(binding) => handleShortcutUpdate(definition, binding)}
              />
            </div>
          );
        })}
        {!enabledShortcuts.length && (
          <p className="helper-text">
            {t(
              I18N_KEYS.popupMessageEnableFeature,
              undefined,
              'Enable a feature above to customize its shortcuts.'
            )}
          </p>
        )}
      </section>

      <footer className="popup-footer">
        <section className="links">
          <div>
            <a
              className="footer-button github-button"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Contribute"
            >
              <span>
                <img className="icon" src={ICON_GITHUB_SRC} alt="Contribute" />
              </span>
            </a>
          </div>
          <div>
            <a
              className="footer-button question-button"
              href={SUPPORT_FORM_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Support"
            >
              <span>
                <img className="icon" src={ICON_SUPPORT_SRC} alt="Report a problem" />
              </span>
            </a>
          </div>
          <div>
            <a
              className="footer-button coffee-button"
              href={COFFEE_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Buy me a coffee"
            >
              <span>
                <img className="icon" src={ICON_COFFEE_SRC} alt="Buy me a coffee" />
              </span>
            </a>
          </div>
        </section>
      </footer>
    </div>
  );
}

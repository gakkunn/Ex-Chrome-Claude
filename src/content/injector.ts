import { INJECT_I18N_KEYS } from '../shared/i18n-keys';
import { MESSAGE_SOURCE, MESSAGE_TYPES } from '../shared/messages';
import {
  SHORTCUT_DEFINITIONS,
  STORAGE_KEY,
  mergeSettings,
  type SettingsData,
} from '../shared/settings';
import { loadSettings } from '../shared/storage';

function injectScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject/index.js');
  script.type = 'module';

  const container = document.head || document.documentElement;
  container.appendChild(script);
}

const INJECT_LOCALE_KEYS = Array.from(
  new Set([...INJECT_I18N_KEYS, ...SHORTCUT_DEFINITIONS.map((def) => def.labelKey)])
);

function buildI18nMessages(): Record<string, string> {
  const messages: Record<string, string> = {};
  const i18n = chrome?.i18n;

  for (const key of INJECT_LOCALE_KEYS) {
    const value = i18n?.getMessage?.(key);
    if (typeof value === 'string' && value.length) {
      messages[key] = value;
    }
  }
  return messages;
}

function postI18n(): void {
  window.postMessage(
    {
      source: MESSAGE_SOURCE,
      type: MESSAGE_TYPES.i18n,
      payload: buildI18nMessages(),
    },
    '*'
  );
}

function postSettings(settings: SettingsData): void {
  window.postMessage(
    {
      source: MESSAGE_SOURCE,
      type: MESSAGE_TYPES.settings,
      payload: settings,
    },
    '*'
  );
}

async function syncSettings(): Promise<void> {
  const settings = await loadSettings();
  postSettings(settings);
}

function setupBridge(): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== MESSAGE_SOURCE) return;

    if (data.type === MESSAGE_TYPES.requestSettings) {
      void syncSettings();
      return;
    }

    if (data.type === MESSAGE_TYPES.requestI18n) {
      postI18n();
      return;
    }

    if (data.type === MESSAGE_TYPES.openSettings) {
      void chrome.runtime.sendMessage({ action: 'openSettings' });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes[STORAGE_KEY]) return;

    const newValue = mergeSettings(changes[STORAGE_KEY].newValue as Partial<SettingsData>);
    postSettings(newValue);
  });
}

injectScript();
setupBridge();
void syncSettings();

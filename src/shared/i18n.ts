import type { I18nKey } from './i18n-keys';

type Substitutions = string | number | Array<string | number>;

const hasChromeI18n = typeof chrome !== 'undefined' && !!chrome.i18n;

const normalizeSubstitutions = (substitutions?: Substitutions): string | string[] | undefined => {
  if (typeof substitutions === 'undefined') {
    return undefined;
  }

  if (Array.isArray(substitutions)) {
    return substitutions.map((value) => `${value}`);
  }

  return `${substitutions}`;
};

export function t(key: I18nKey, substitutions?: Substitutions, fallback?: string): string {
  if (hasChromeI18n && typeof chrome.i18n?.getMessage === 'function') {
    const normalized = normalizeSubstitutions(substitutions);
    const message = chrome.i18n.getMessage(key, normalized);
    if (message) {
      return message;
    }
  }

  if (typeof fallback === 'string') {
    return fallback;
  }

  return key;
}

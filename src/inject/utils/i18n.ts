import type { I18nKey } from '@/shared/i18n-keys';

type LocaleDictionary = Record<I18nKey | string, string>;

const getDictionary = (): LocaleDictionary => {
  if (typeof window === 'undefined') {
    return {};
  }
  return window.__CPS_I18N__ ?? {};
};

export function tp(key: I18nKey, fallback?: string): string {
  const dictionary = getDictionary();
  const value = dictionary[key];
  if (typeof value === 'string' && value.length) {
    return value;
  }
  if (typeof fallback === 'string' && fallback.length) {
    return fallback;
  }
  return key;
}

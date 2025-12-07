import { DEFAULT_SETTINGS, STORAGE_KEY, mergeSettings } from './settings';
import type { SettingsData } from './settings';

export async function loadSettings(): Promise<SettingsData> {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        if (chrome.runtime.lastError) {
          resolve({ ...DEFAULT_SETTINGS });
          return;
        }

        const raw = data?.[STORAGE_KEY] as Partial<SettingsData> | undefined;
        resolve(mergeSettings(raw));
      });
    } catch {
      resolve({ ...DEFAULT_SETTINGS });
    }
  });
}

export async function saveSettings(update: Partial<SettingsData>): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const existing = mergeSettings((data?.[STORAGE_KEY] as Partial<SettingsData>) ?? {});
        const merged: SettingsData = mergeSettings({
          ...existing,
          ...update,
          featureToggles: { ...existing.featureToggles, ...(update.featureToggles ?? {}) },
          shortcuts: { ...existing.shortcuts, ...(update.shortcuts ?? {}) },
        });

        chrome.storage.sync.set({ [STORAGE_KEY]: merged }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

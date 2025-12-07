import { STORAGE_KEY, mergeSettings } from '../shared/settings';
import { loadSettings } from '../shared/storage';

(() => {
  let safeSendEnabled = true;
  let listenersBound = false;

  const handler = (e: KeyboardEvent): void => {
    if (!safeSendEnabled) return;
    if (e.key !== 'Enter') return;
    if (e.isComposing || e.keyCode === 229) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.target;
    if (!(target instanceof Element)) return;

    const editable = target.closest('div[contenteditable="true"][data-testid="chat-input"]');
    if (!editable) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if (e.type === 'keydown') {
      const synthetic = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
        shiftKey: true,
      });

      editable.dispatchEvent(synthetic);
    }
  };

  function bindListeners(): void {
    if (listenersBound) return;
    window.addEventListener('keydown', handler, true);
    window.addEventListener('keypress', handler, true);
    listenersBound = true;
  }

  function unbindListeners(): void {
    if (!listenersBound) return;
    window.removeEventListener('keydown', handler, true);
    window.removeEventListener('keypress', handler, true);
    listenersBound = false;
  }

  function applySafeSend(enabled: boolean): void {
    safeSendEnabled = enabled;
    if (enabled) {
      bindListeners();
    } else {
      unbindListeners();
    }
  }

  async function init(): Promise<void> {
    if (window.__claudeEnterToNewlineHandler) {
      window.removeEventListener('keydown', window.__claudeEnterToNewlineHandler, true);
      window.removeEventListener('keypress', window.__claudeEnterToNewlineHandler, true);
    }

    window.__claudeEnterToNewlineHandler = handler;

    const settings = await loadSettings();
    applySafeSend(settings.featureToggles.safeSend);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (!changes[STORAGE_KEY]) return;

      const merged = mergeSettings(changes[STORAGE_KEY].newValue);
      applySafeSend(merged.featureToggles.safeSend);
    });
  }

  void init();
})();

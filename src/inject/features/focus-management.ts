const RETRIES = 10;
const INTERVAL = 200;
const CONTAINER_SELECTOR = '[data-testid="chat-input-grid-container"]';
const RICH_INPUT_SELECTOR =
  'div.tiptap.ProseMirror[contenteditable="true"][data-testid="chat-input"]';
const SSR_INPUT_SELECTOR = 'textarea[data-testid="chat-input-ssr"]';
const FIELDSET_CLASS = 'cws-fieldset';
const COMPOSER_CLASS = 'cws-composer';
const FOCUSED_CLASS = 'cws-focused';

type InputElement = HTMLElement;

interface BindingMeta {
  ac: AbortController;
  fieldset: HTMLElement;
  composer: HTMLElement;
}

export class FocusManager {
  private bindings = new Map<InputElement, BindingMeta>();
  private lastInput: InputElement | null = null;
  private retryTimer: number | null = null;
  private navigationHooked = false;
  private enabled = false;

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.hookHistory();
    this.scheduleScan();
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.cleanup();
  }

  toggleFocus(): void {
    if (!this.enabled) return;
    const active = this.getActiveInput();
    if (active) {
      this.blurInput(active);
      return;
    }

    const target = this.chooseTargetInput();
    if (target) {
      this.focusInput(target);
    }
  }

  refresh(): void {
    if (!this.enabled) return;
    this.scheduleScan();
  }

  private collectInputs(): InputElement[] {
    const inputs: InputElement[] = [];
    const containers = document.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR);
    containers.forEach((container) => {
      inputs.push(
        ...container.querySelectorAll<InputElement>(RICH_INPUT_SELECTOR),
        ...container.querySelectorAll<InputElement>(SSR_INPUT_SELECTOR)
      );
    });
    return inputs;
  }

  private findComposer(input: InputElement, fieldset: HTMLElement): HTMLElement | null {
    const byCursor = input.closest<HTMLElement>('div.cursor-text');
    if (byCursor) return byCursor;

    const fromFieldset = fieldset.querySelector<HTMLElement>('div.cursor-text');
    if (fromFieldset) return fromFieldset;

    return fieldset.querySelector<HTMLElement>('div');
  }

  private isInputFocused(input: InputElement): boolean {
    return document.activeElement === input || input.classList.contains('ProseMirror-focused');
  }

  private setFocusState(input: InputElement, fieldset: HTMLElement, isFocused: boolean): void {
    fieldset.classList.toggle(FOCUSED_CLASS, isFocused);
    if (isFocused) this.lastInput = input;
  }

  private bindInput(input: InputElement): void {
    if (this.bindings.has(input)) return;
    if (!this.enabled) return;

    const fieldset = input.closest('fieldset');
    if (!fieldset) return;

    const container = fieldset.closest(CONTAINER_SELECTOR);
    if (!container) return;
    if (fieldset.getAttribute('aria-hidden') === 'true') return;

    const composer = this.findComposer(input, fieldset);
    if (!composer) return;

    fieldset.classList.add(FIELDSET_CLASS);
    composer.classList.add(COMPOSER_CLASS);

    const ac = new AbortController();
    const { signal } = ac;

    const onFocus = (): void => this.setFocusState(input, fieldset, true);
    const onBlur = (): void => this.setFocusState(input, fieldset, false);

    input.addEventListener('focus', onFocus, { signal });
    input.addEventListener('blur', onBlur, { signal });

    this.setFocusState(input, fieldset, this.isInputFocused(input));
    this.bindings.set(input, { ac, fieldset, composer });
  }

  private prune(liveInputs: InputElement[]): void {
    const liveSet = new Set(liveInputs);
    for (const [input, meta] of this.bindings) {
      if (!liveSet.has(input) || !document.contains(input)) {
        meta.ac.abort();
        meta.fieldset.classList.remove(FOCUSED_CLASS, FIELDSET_CLASS);
        meta.composer.classList.remove(COMPOSER_CLASS);
        this.bindings.delete(input);
      }
    }
  }

  private getActiveInput(): InputElement | null {
    for (const input of this.bindings.keys()) {
      if (this.isInputFocused(input)) return input;
    }
    return null;
  }

  private chooseTargetInput(): InputElement | null {
    if (this.lastInput && this.bindings.has(this.lastInput) && document.contains(this.lastInput)) {
      return this.lastInput;
    }
    const iterator = this.bindings.keys().next();
    return iterator.done ? null : iterator.value;
  }

  private focusInput(input: InputElement): void {
    const meta = this.bindings.get(input);
    if (meta) meta.fieldset.classList.add(FOCUSED_CLASS);
    input.focus();
  }

  private blurInput(input: InputElement): void {
    const meta = this.bindings.get(input);
    if (meta) meta.fieldset.classList.remove(FOCUSED_CLASS);
    input.blur();
  }

  private scheduleScan(retries = RETRIES, interval = INTERVAL): void {
    if (!this.enabled) return;
    let attempts = 0;
    if (this.retryTimer !== null) {
      window.clearInterval(this.retryTimer);
    }

    this.retryTimer = window.setInterval(() => {
      if (!this.enabled) {
        if (this.retryTimer !== null) window.clearInterval(this.retryTimer);
        this.retryTimer = null;
        return;
      }

      const inputs = this.collectInputs();
      inputs.forEach((input) => this.bindInput(input));
      this.prune(inputs);

      attempts += 1;
      if (attempts >= retries && this.retryTimer !== null) {
        window.clearInterval(this.retryTimer);
        this.retryTimer = null;
      }
    }, interval);
  }

  private hookHistory(): void {
    if (this.navigationHooked) return;
    this.navigationHooked = true;

    const originalPushState = history.pushState.bind(history);
    history.pushState = ((...args: Parameters<History['pushState']>) => {
      this.scheduleScan();
      return originalPushState(...args);
    }) as History['pushState'];

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      this.scheduleScan();
      return originalReplaceState(...args);
    }) as History['replaceState'];

    window.addEventListener('popstate', () => this.scheduleScan());
  }

  private cleanup(): void {
    if (this.retryTimer !== null) {
      window.clearInterval(this.retryTimer);
      this.retryTimer = null;
    }

    for (const [, meta] of this.bindings) {
      meta.ac.abort();
      meta.fieldset.classList.remove(FOCUSED_CLASS, FIELDSET_CLASS);
      meta.composer.classList.remove(COMPOSER_CLASS);
    }
    this.bindings.clear();
    this.lastInput = null;
  }
}

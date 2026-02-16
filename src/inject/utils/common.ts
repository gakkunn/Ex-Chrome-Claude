export const SELECTORS = {
  CLAUDE_INPUT: [
    'textarea[placeholder*="Claude"]',
    'textarea[placeholder*="Message"]',
    'textarea',
    '[contenteditable="true"][data-placeholder]',
    '[contenteditable="true"][role="textbox"]',
  ],
  SIDEBAR_OPEN_BUTTON: 'button[data-testid="pin-sidebar-toggle"][aria-label="Open sidebar"]',
  SIDEBAR_PIN_TOGGLE: 'button[data-testid="pin-sidebar-toggle"]',
  NEW_CHAT_LINK:
    'nav[aria-label="Sidebar"] a[aria-label="New chat"][data-dd-action-name="sidebar-new-item"]',
  CHAT_MENU_TRIGGER: 'button[data-testid="chat-menu-trigger"]',
  MODEL_DROPDOWN: 'button[data-testid="model-selector-dropdown"]',
  MODEL_MENU_CONTAINER_CANDIDATES: [
    'div[data-radix-menu-content][role="menu"][data-state="open"]',
    'div[role="menu"][data-open]',
    'div[role="menu"][data-rootownerid]',
  ],
  MODEL_MENU_ITEM: 'div[role="menuitem"]',
  MODEL_MENU_ITEM_LABEL: '.font-ui, .font-ui-serif',
} as const;

const DEFAULT_WAIT_OPTIONS = {
  timeout: 3000,
  interval: 50,
} as const;

export interface WaitOptions {
  timeout?: number;
  interval?: number;
}

export interface ScrollPositionSnapshot {
  element: HTMLElement;
  top: number;
  left: number;
}

export function isEditableElement(el: EventTarget | null): el is HTMLElement {
  if (!el || !(el instanceof Element)) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;

  const tag = el.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

  if (el.getAttribute?.('role') === 'textbox' && el.getAttribute?.('contenteditable') === 'true') {
    return true;
  }

  return false;
}

export function simulateMouseClick(target: Element | null): void {
  if (!target) return;

  (['pointerdown', 'mousedown', 'mouseup', 'click'] as const).forEach((type) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      buttons: 1,
    });
    target.dispatchEvent(event);
  });
}

export function waitForElement<T extends Element>(
  selector: string,
  options: WaitOptions = {}
): Promise<T> {
  const { timeout, interval } = { ...DEFAULT_WAIT_OPTIONS, ...options };

  return new Promise<T>((resolve, reject) => {
    const immediate = document.querySelector<T>(selector);
    if (immediate) {
      resolve(immediate);
      return;
    }

    const start = performance.now();
    const timer = window.setInterval(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        window.clearInterval(timer);
        resolve(el);
        return;
      }

      if (performance.now() - start > timeout) {
        window.clearInterval(timer);
        reject(new Error(`Timeout waiting for selector: ${selector}`));
      }
    }, interval);
  });
}

export function waitFor<T>(
  conditionFn: () => T | null | false | undefined,
  options: WaitOptions = {}
): Promise<T> {
  const { timeout, interval } = { ...DEFAULT_WAIT_OPTIONS, ...options };

  return new Promise<T>((resolve, reject) => {
    try {
      const immediate = conditionFn();
      if (immediate) {
        resolve(immediate);
        return;
      }
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const start = performance.now();
    const timer = window.setInterval(() => {
      try {
        const result = conditionFn();
        if (result) {
          window.clearInterval(timer);
          resolve(result);
          return;
        }
        if (performance.now() - start > timeout) {
          window.clearInterval(timer);
          reject(new Error('Timeout in waitFor()'));
        }
      } catch (error) {
        window.clearInterval(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, interval);
  });
}

export function scrollIntoViewSafe(
  element: Element | null,
  options: ScrollIntoViewOptions = {}
): void {
  if (!element) return;
  try {
    element.scrollIntoView({ block: 'center', inline: 'nearest', ...options });
  } catch {
    // Ignore errors
  }
}

function isAxisScrollable(styleValue: string, scrollSize: number, clientSize: number): boolean {
  return (
    (styleValue === 'auto' || styleValue === 'scroll' || styleValue === 'overlay') &&
    scrollSize > clientSize + 1
  );
}

export function getScrollableAncestors(element: Element | null): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  let current: HTMLElement | null =
    element instanceof HTMLElement ? element.parentElement : (element?.parentElement ?? null);

  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    const canScrollY = isAxisScrollable(
      style.overflowY,
      current.scrollHeight,
      current.clientHeight
    );
    const canScrollX = isAxisScrollable(style.overflowX, current.scrollWidth, current.clientWidth);
    if ((canScrollY || canScrollX) && !seen.has(current)) {
      ancestors.push(current);
      seen.add(current);
    }
    current = current.parentElement;
  }

  const root = (document.scrollingElement as HTMLElement | null) || document.documentElement;
  if (root && !seen.has(root)) {
    ancestors.push(root);
  }

  return ancestors;
}

export function captureScrollPositions(
  elements: Array<HTMLElement | null | undefined>
): ScrollPositionSnapshot[] {
  const snapshots: ScrollPositionSnapshot[] = [];
  const seen = new Set<HTMLElement>();

  elements.forEach((element) => {
    if (!element || seen.has(element)) return;
    seen.add(element);
    snapshots.push({
      element,
      top: element.scrollTop,
      left: element.scrollLeft,
    });
  });

  return snapshots;
}

export function restoreScrollPositions(snapshots: ScrollPositionSnapshot[]): void {
  snapshots.forEach(({ element, top, left }) => {
    if (!element.isConnected) return;
    element.scrollTop = top;
    element.scrollLeft = left;
  });
}

export function getClaudeInputElement(): HTMLElement | null {
  for (const selector of SELECTORS.CLAUDE_INPUT) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && (el.offsetHeight || el.getClientRects().length)) {
      return el;
    }
  }
  return null;
}

export function getScrollContainer(): HTMLElement {
  let container = document.scrollingElement as HTMLElement | null;
  if (!container) container = document.documentElement || document.body;

  const input = getClaudeInputElement();
  if (!input) return container;

  let current: HTMLElement | null = input.parentElement;
  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    const overflowY = style.overflowY;
    const scrollable =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight + 8;

    if (scrollable) {
      container = current;
      break;
    }
    current = current.parentElement;
  }

  return container;
}

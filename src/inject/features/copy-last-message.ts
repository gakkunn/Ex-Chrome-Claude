import {
  captureScrollPositions,
  getScrollableAncestors,
  restoreScrollPositions,
  simulateMouseClick,
} from '../utils/common';

const USER_MESSAGE_SELECTOR = '[data-testid="user-message"]';
const COPY_BUTTON_SELECTOR = 'button[data-testid="action-bar-copy"]';

function getLastUserMessage(): HTMLElement | null {
  const messages = document.querySelectorAll<HTMLElement>(USER_MESSAGE_SELECTOR);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message.isConnected) continue;
    if (!(message.offsetHeight || message.getClientRects().length)) continue;
    if (!(message.textContent || '').trim()) continue;
    return message;
  }
  return null;
}

function findCopyButtonForMessage(message: HTMLElement): HTMLButtonElement | null {
  let current: HTMLElement | null = message;
  while (current && current !== document.body) {
    const button = current.querySelector<HTMLButtonElement>(COPY_BUTTON_SELECTOR);
    if (button) return button;
    current = current.parentElement;
  }
  return null;
}

function clickWithoutMovingViewport(message: HTMLElement, button: HTMLButtonElement): void {
  const snapshots = captureScrollPositions(getScrollableAncestors(message));
  simulateMouseClick(button);
  restoreScrollPositions(snapshots);
  requestAnimationFrame(() => restoreScrollPositions(snapshots));
}

export function copyLastUserMessageViaActionBar(): boolean {
  const message = getLastUserMessage();
  if (!message) return false;

  const button = findCopyButtonForMessage(message);
  if (!button || button.disabled) return false;

  clickWithoutMovingViewport(message, button);
  return true;
}

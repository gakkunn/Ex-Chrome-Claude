import { isModKey } from '@/shared/keyboard';

import type { ClaudeVimScrollHandle } from '../types/global';
import {
  getScrollContainer,
  isEditableElement,
  isKeyboardEventInEditableContext,
} from '../utils/common';

type ScrollDirection = 'up' | 'down' | null;
export type ScrollAction = 'top' | 'bottom' | 'up' | 'down' | 'halfUp' | 'halfDown';

const SCROLLING_SPEED = 20;
const STEP = 60;
const STEP_REPEAT = 15;
const DURATION_FAST = 100;
const DURATION_SMOOTH = 200;

let scrollingDirection: ScrollDirection = null;
let scrollingAnimationId: number | null = null;
let scrollingContainer: HTMLElement | null = null;
let scrollingKey: string | null = null;

function stopContinuousScroll(): void {
  scrollingDirection = null;
  scrollingContainer = null;
  if (scrollingAnimationId != null) {
    cancelAnimationFrame(scrollingAnimationId);
    scrollingAnimationId = null;
  }
}

function startContinuousScroll(
  container: HTMLElement,
  direction: Exclude<ScrollDirection, null>
): void {
  stopContinuousScroll();

  scrollingDirection = direction;
  scrollingContainer = container;

  const frame = (): void => {
    if (!scrollingContainer || scrollingDirection == null) return;

    const delta = scrollingDirection === 'up' ? -SCROLLING_SPEED : SCROLLING_SPEED;
    const maxScrollTop = scrollingContainer.scrollHeight - scrollingContainer.clientHeight;
    const nextTop = Math.max(0, Math.min(scrollingContainer.scrollTop + delta, maxScrollTop));

    scrollingContainer.scrollTop = nextTop;

    if (nextTop === 0 || nextTop === maxScrollTop) {
      stopContinuousScroll();
      return;
    }

    scrollingAnimationId = requestAnimationFrame(frame);
  };

  scrollingAnimationId = requestAnimationFrame(frame);
}

function animateScroll(container: HTMLElement, targetTop: number, duration: number): void {
  const start = container.scrollTop;
  const change = targetTop - start;
  const startTime = performance.now();

  const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  const step = (now: number): void => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutQuad(progress);

    container.scrollTop = start + change * eased;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

export class VimScrollController {
  handleShortcut(event: KeyboardEvent, action: ScrollAction): boolean {
    const inEditable = isKeyboardEventInEditableContext(event);
    if (inEditable) {
      return false;
    }

    const container = getScrollContainer();
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    const maxScrollTop = container.scrollHeight - container.clientHeight;
    let targetTop: number;

    switch (action) {
      case 'top':
        targetTop = 0;
        break;
      case 'bottom':
        targetTop = maxScrollTop;
        break;
      case 'up':
        targetTop = container.scrollTop - (event.repeat ? STEP_REPEAT : STEP);
        break;
      case 'down':
        targetTop = container.scrollTop + (event.repeat ? STEP_REPEAT : STEP);
        break;
      case 'halfUp':
        targetTop = container.scrollTop - window.innerHeight / 2;
        break;
      case 'halfDown':
        targetTop = container.scrollTop + window.innerHeight / 2;
        break;
      default:
        return false;
    }

    targetTop = Math.max(0, Math.min(targetTop, maxScrollTop));

    if (action === 'up' || action === 'down') {
      const direction: Exclude<ScrollDirection, null> = action === 'up' ? 'up' : 'down';

      if (!event.repeat) {
        animateScroll(container, targetTop, DURATION_FAST);
        scrollingKey = event.key.toLowerCase();

        window.setTimeout(() => {
          if (
            scrollingKey === event.key.toLowerCase() &&
            scrollingDirection === null &&
            !isEditableElement(document.activeElement)
          ) {
            startContinuousScroll(container, direction);
          }
        }, DURATION_FAST);
      } else if (scrollingDirection === null) {
        startContinuousScroll(container, direction);
      }
    } else if (event.repeat) {
      container.scrollTop = targetTop;
    } else {
      animateScroll(container, targetTop, DURATION_SMOOTH);
    }

    return true;
  }

  handleKeyup(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (scrollingKey && key === scrollingKey) {
      stopContinuousScroll();
      scrollingKey = null;
    }
  }

  destroy(): void {
    stopContinuousScroll();
  }
}

export const vimScrollController = new VimScrollController();

export function initVimScroll(): void {
  window.__claudeVimScroll?.destroy();

  const onKeydown = (e: KeyboardEvent): void => {
    const key = e.key;

    if (isModKey(e) && !e.altKey && !e.shiftKey) {
      if (key === 'j' || key === 'J') {
        if (vimScrollController.handleShortcut(e, 'bottom')) return;
      }
      if (key === 'k' || key === 'K') {
        if (vimScrollController.handleShortcut(e, 'top')) return;
      }
    }

    if (!isModKey(e) && !e.altKey && e.shiftKey) {
      if (key === 'J') {
        if (vimScrollController.handleShortcut(e, 'halfDown')) return;
      }
      if (key === 'K') {
        if (vimScrollController.handleShortcut(e, 'halfUp')) return;
      }
    }

    if (!isModKey(e) && !e.altKey && !e.shiftKey) {
      if (key === 'j') {
        if (vimScrollController.handleShortcut(e, 'down')) return;
      }
      if (key === 'k') {
        if (vimScrollController.handleShortcut(e, 'up')) return;
      }
    }
  };

  const onKeyup = (e: KeyboardEvent): void => {
    vimScrollController.handleKeyup(e);
  };

  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('keyup', onKeyup, true);

  const handle: ClaudeVimScrollHandle = {
    destroy() {
      stopContinuousScroll();
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('keyup', onKeyup, true);
    },
  };

  window.__claudeVimScroll = handle;
}

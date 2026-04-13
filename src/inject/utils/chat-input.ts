export const RICH_CHAT_INPUT_SELECTOR =
  'div.tiptap.ProseMirror[contenteditable="true"][data-testid="chat-input"]';
export const SSR_CHAT_INPUT_SELECTOR = 'textarea[data-testid="chat-input-ssr"]';
export const CHAT_INPUT_SELECTOR = `${RICH_CHAT_INPUT_SELECTOR}, ${SSR_CHAT_INPUT_SELECTOR}`;

export const CHAT_INPUT_CONTAINER_SELECTORS = [
  '[data-testid="chat-input-grid-container"]',
  '[data-chat-input-container="true"]',
] as const;

export const CPS_CHAT_INPUT_CONTAINER_ATTRIBUTE = 'data-cps-chat-input-container';
export const CPS_CHAT_INPUT_CONTAINER_SELECTOR = `[${CPS_CHAT_INPUT_CONTAINER_ATTRIBUTE}="true"]`;
export const CHAT_INPUT_CONTAINER_SELECTOR = [
  ...CHAT_INPUT_CONTAINER_SELECTORS,
  CPS_CHAT_INPUT_CONTAINER_SELECTOR,
].join(', ');

export interface ResolvedChatInputTarget {
  container: HTMLElement;
  fieldset: HTMLElement;
  input: HTMLElement;
  usesFallbackContainer: boolean;
}

function markFallbackContainer(container: HTMLElement): HTMLElement {
  container.setAttribute(CPS_CHAT_INPUT_CONTAINER_ATTRIBUTE, 'true');
  return container;
}

export function resolveChatInputTarget(input: HTMLElement): ResolvedChatInputTarget | null {
  const fieldset = input.closest<HTMLElement>('fieldset');
  if (!fieldset) return null;

  const officialContainer = input.closest<HTMLElement>(CHAT_INPUT_CONTAINER_SELECTOR);
  if (officialContainer) {
    return {
      container: officialContainer,
      fieldset,
      input,
      usesFallbackContainer: officialContainer.matches(CPS_CHAT_INPUT_CONTAINER_SELECTOR),
    };
  }

  const fallbackContainer = fieldset.parentElement;
  if (!fallbackContainer) return null;

  return {
    container: markFallbackContainer(fallbackContainer),
    fieldset,
    input,
    usesFallbackContainer: true,
  };
}

export function resolveChatInputContainerFromElement(element: Element): HTMLElement | null {
  const directContainer = element.closest<HTMLElement>(CHAT_INPUT_CONTAINER_SELECTOR);
  if (directContainer) return directContainer;

  const fieldset = element.closest<HTMLElement>('fieldset');
  if (!fieldset) return null;
  if (!fieldset.querySelector(CHAT_INPUT_SELECTOR)) return null;

  const fallbackContainer = fieldset.parentElement;
  if (!fallbackContainer) return null;
  return markFallbackContainer(fallbackContainer);
}

export function collectChatInputTargets(root: ParentNode = document): ResolvedChatInputTarget[] {
  const inputs = root.querySelectorAll<HTMLElement>(CHAT_INPUT_SELECTOR);
  const targets: ResolvedChatInputTarget[] = [];

  for (const input of inputs) {
    const target = resolveChatInputTarget(input);
    if (target) {
      targets.push(target);
    }
  }

  return targets;
}

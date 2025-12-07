export interface ClaudeVimScrollHandle {
  destroy: () => void;
}

declare global {
  interface Window {
    __claudeEnterToNewlineHandler?: (e: KeyboardEvent) => void;
    __claudeVimScroll?: ClaudeVimScrollHandle;
    __pinSidebarShortcutHandler?: (e: KeyboardEvent) => void;
    __newChatShortcutListener?: (e: KeyboardEvent) => void;
    __starChatShortcutListener?: (e: KeyboardEvent) => void;
    __starChatToastTimer?: number;
    __deleteChatShortcutListener?: (e: KeyboardEvent) => void;
    __incognitoChatShortcutListener?: (e: KeyboardEvent) => void;
    __modelShortcutState?: {
      keydownListener?: (e: KeyboardEvent) => void;
      beforeInputListener?: (e: InputEvent) => void;
      lastShortcutAt?: number;
    };
    __CPS_I18N__?: Record<string, string>;
  }
}

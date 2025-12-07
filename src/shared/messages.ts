export const MESSAGE_SOURCE = 'claude-power-suite';

export const MESSAGE_TYPES = {
  requestSettings: 'cps-request-settings',
  settings: 'cps-settings',
  openSettings: 'cps-open-settings',
  requestI18n: 'cps-request-i18n',
  i18n: 'cps-i18n',
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export interface SettingsMessage<T = unknown> {
  source: typeof MESSAGE_SOURCE;
  type: MessageType;
  payload?: T;
}

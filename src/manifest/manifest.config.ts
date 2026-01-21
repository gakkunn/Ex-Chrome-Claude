import { defineManifest } from '@crxjs/vite-plugin';

const hostMatches = ['https://claude.ai/*'];

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extension_name__',
  version: '1.2.0',
  description: '__MSG_extension_description__',
  default_locale: 'en',
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  commands: {
    reload_extension_dev: {
      suggested_key: {
        default: 'Ctrl+Shift+R',
        mac: 'Command+Shift+R',
      },
      description: 'Reload extension (dev only)',
    },
  },
  options_ui: {
    page: 'src/popup/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage'],
  host_permissions: hostMatches,
  content_scripts: [
    {
      matches: hostMatches,
      js: ['src/content/enter-newline.ts'],
      run_at: 'document_start',
    },
    {
      matches: hostMatches,
      js: ['src/content/injector.ts'],
      css: ['styles/style.css'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['inject/index.js', 'assets/*.js'],
      matches: hostMatches,
    },
  ],
});

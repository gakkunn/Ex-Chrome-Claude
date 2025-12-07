import { fileURLToPath, URL } from 'node:url';

import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

import manifest from './src/manifest/manifest.config';

const resolvePath = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [preact(), crx({ manifest })],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    ...(isProduction
      ? {
          esbuild: {
            drop: ['console', 'debugger'],
          },
        }
      : {}),
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          background: resolvePath('./src/background/index.ts'),
          contentInjector: resolvePath('./src/content/injector.ts'),
          contentEnterNewline: resolvePath('./src/content/enter-newline.ts'),
          inject: resolvePath('./src/inject/index.ts'),
          popup: resolvePath('./src/popup/index.html'),
        },
        output: {
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === 'inject' ? 'inject/index.js' : 'assets/[name]-[hash].js',
        },
      },
    },
  };
});

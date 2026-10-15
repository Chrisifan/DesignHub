import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: resolve(import.meta.dirname, 'scripts/provider-live-smoke-entry.ts'),
    outDir: resolve(import.meta.dirname, '.vite/provider-live-smoke'),
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'provider-live-smoke.mjs' },
    },
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  cacheDir: '.vite/ui-dev-cache',
  build: { outDir: '.vite/renderer', emptyOutDir: true },
});

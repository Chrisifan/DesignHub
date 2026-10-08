import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  cacheDir: '.vite/ui-dev-cache',
  build: {
    outDir: '.vite/renderer',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          const normalizedId = id.replaceAll('\\', '/');
          return normalizedId.includes('/node_modules/react-konva/') || normalizedId.includes('/node_modules/konva/') ? 'canvas' : undefined;
        },
      },
    },
  },
});

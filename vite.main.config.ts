import { defineConfig } from 'vite';

export default defineConfig({ build: { lib: { entry: 'src/desktop/main.ts', formats: ['cjs'], fileName: 'main' }, outDir: '.vite/build', rollupOptions: { external: ['electron', 'node:path', 'node:url'] } } });

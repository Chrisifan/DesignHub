import { defineConfig } from 'vite';

export default defineConfig({ build: { lib: { entry: 'src/desktop/preload.ts', formats: ['cjs'], fileName: 'preload' }, outDir: '.vite/build', emptyOutDir: false, rollupOptions: { external: ['electron'] } } });

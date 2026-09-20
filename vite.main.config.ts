import { defineConfig } from 'vite';

export default defineConfig({ build: { lib: { entry: 'src/desktop/main.ts', formats: ['cjs'], fileName: 'main' }, outDir: '.vite/build', rollupOptions: { external: ['electron', 'node:crypto', 'node:fs', 'node:fs/promises', 'node:os', 'node:path', 'node:url', 'better-sqlite3', '@napi-rs/keyring', 'sharp'] } } });

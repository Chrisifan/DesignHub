import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

import config from '../../forge.config';
import viteMainConfig from '../../vite.main.config';
import vitePreloadConfig from '../../vite.preload.config';

it('registers the Forge plugin that unpacks native Node modules from ASAR', () => {
  expect(config.plugins.map((plugin) => plugin.name)).toContain('auto-unpack-natives');
});

it('keeps the main-only project storage entry and its native SQLite dependency packageable', async () => {
  const storageEntry = await readFile('src/desktop/main.ts', 'utf8');
  const external = viteMainConfig.build?.rollupOptions?.external;

  expect(storageEntry).toContain("./storage/project-store");
  expect(storageEntry).toContain("typeof MAIN_WINDOW_VITE_DEV_SERVER_URL");
  expect(external).toContain('better-sqlite3');
  expect(config.packagerConfig.ignore('')).toBe(false);
  expect(config.packagerConfig.ignore('/package.json')).toBe(false);
  expect(config.packagerConfig.ignore('/node_modules')).toBe(false);
  expect(config.packagerConfig.ignore('/node_modules/better-sqlite3')).toBe(false);
  expect(config.packagerConfig.ignore('/node_modules/better-sqlite3/lib/index.js')).toBe(false);
  expect(config.packagerConfig.ignore('/node_modules/other-package/index.js')).toBe(true);
});

it('preserves the main entry when the preload build shares its output directory', () => {
  expect(vitePreloadConfig.build?.emptyOutDir).toBe(false);
});

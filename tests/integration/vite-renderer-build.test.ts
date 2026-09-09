import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';

it('emits renderer HTML whose assets resolve relative to the loaded file', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'designhub-vite-renderer-'));
  const outputDirectory = join(outputRoot, 'renderer');

  try {
    await build({ configFile: resolve('vite.config.ts'), build: { outDir: outputDirectory, emptyOutDir: true } });
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');

    expect(html).not.toMatch(/(?:src|href)="\/assets\//);
    expect(html).toMatch(/(?:src|href)="\.\/assets\//);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

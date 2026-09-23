import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

import { createBrandSnapshot, type Brand } from '../../features/brands/constraints';
import { initializeProjectLibrary } from './project-library-store';
import { loadBrandState, saveBrandState, brandsFileName } from './brand-store';

const brand: Brand = {
  id: 'local-brand', version: 'v1', name: 'Spring', logo: 'mark',
  colorPalette: ['#fff'], fonts: ['Geist'], tone: 'Calm', fixedCopy: 'Hello', sizes: ['1080x1440'],
};

it('persists brands inside the workspace and restores them after reopening', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-brand-'));
  try {
    const handle = await initializeProjectLibrary(root);
    await saveBrandState(handle, handle.library.libraryId, { brands: [brand] });
    handle.close();
    const reopened = await (await import('./project-library-store')).openProjectLibrary(handle.library.directory);
    await expect(loadBrandState(reopened, reopened.library.libraryId)).resolves.toEqual({ brands: [brand] });
    reopened.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('writes an atomic schema and rejects malformed persisted content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-brand-'));
  try {
    const handle = await initializeProjectLibrary(root);
    await saveBrandState(handle, handle.library.libraryId, { brands: [brand] });
    const path = join(handle.library.directory, '.designhub', brandsFileName);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ brands: [brand] });
    await writeFile(path, '{"brands":[{"id":"bad"}]}');
    await expect(loadBrandState(handle, handle.library.libraryId)).rejects.toThrow('INVALID_BRAND_STATE');
    handle.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects a symlinked brand state instead of reading outside the workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-brand-'));
  try {
    const handle = await initializeProjectLibrary(root);
    const path = join(handle.library.directory, '.designhub', brandsFileName);
    const external = join(root, 'external-brands.json');
    await writeFile(external, JSON.stringify({ brands: [brand] }), 'utf8');
    await symlink(external, path);
    await expect(loadBrandState(handle, handle.library.libraryId)).rejects.toThrow('INVALID_BRAND_STATE');
    handle.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps project snapshots independent from later persisted brand edits', () => {
  const snapshot = createBrandSnapshot(brand);
  brand.colorPalette.push('#000');
  expect(snapshot.colorPalette).toEqual(['#fff']);
});

it('hides removed preview seed brands during workspace migration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-brand-'));
  try {
    const handle = await initializeProjectLibrary(root);
    const legacy = { ...brand, id: 'spring', name: '春间市集', logo: 'spring-mark' };
    const custom = { ...brand, id: 'brand-custom', name: '我的品牌' };
    const path = join(handle.library.directory, '.designhub', brandsFileName);
    await writeFile(path, JSON.stringify({ brands: [legacy, custom] }), 'utf8');
    await expect(loadBrandState(handle, handle.library.libraryId)).resolves.toEqual({ brands: [custom] });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ brands: [custom] });
    handle.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

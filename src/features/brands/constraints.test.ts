import { expect, it } from 'vitest';

import {
  createBrandStore,
  createBrandSnapshot,
  resolveConstraint,
  type Brand,
} from './constraints';

const brand: Brand = {
  id: 'spring',
  version: 'v1',
  logo: 'spring-mark',
  colorPalette: ['#101010', '#f5f5f5'],
  fonts: ['Source Han Serif', 'Geist'],
  tone: 'Relaxed and natural',
  fixedCopy: 'Bring spring home',
  sizes: ['1080x1440', '1080x1080'],
};

it('resolves the most specific constraint and lets an empty string clear lower scopes', () => {
  expect(resolveConstraint({ instruction: 'White', brand: 'Black' })).toBe('White');
  expect(resolveConstraint({ document: '', brand: 'Brand headline' })).toBe('');
  expect(resolveConstraint({ designer: 'Editorial', global: 'Default' })).toBe('Editorial');
  expect(resolveConstraint({ global: 'Default' })).toBe('Default');
  expect(resolveConstraint({})).toBeUndefined();
});

it('creates, updates, lists, and removes complete brand records', () => {
  const store = createBrandStore();
  expect(store.create(brand)).toEqual(brand);
  expect(store.update('spring', { tone: 'Calm and clear', version: 'v2' })).toMatchObject({
    id: 'spring',
    version: 'v2',
    tone: 'Calm and clear',
  });
  expect(store.list()).toHaveLength(1);
  expect(store.remove('spring')).toBe(true);
  expect(store.list()).toEqual([]);
});

it('isolates caller inputs and every CRUD result from nested mutable brand fields', () => {
  const input = structuredClone(brand);
  const store = createBrandStore();
  const created = store.create(input);
  input.colorPalette.push('#ffffff');
  created.fonts[0] = 'Changed';
  expect(store.get('spring')).toMatchObject({
    colorPalette: ['#101010', '#f5f5f5'],
    fonts: ['Source Han Serif', 'Geist'],
  });

  const patch = { sizes: ['1600x900'] };
  const updated = store.update('spring', patch);
  patch.sizes.push('1080x1080');
  updated.sizes.push('1200x1200');
  const listed = store.list();
  listed[0].sizes[0] = 'Changed again';
  expect(store.get('spring')?.sizes).toEqual(['1600x900']);
});

it('snapshots brand fields deeply so later edits cannot rewrite the snapshot', () => {
  const source = { ...brand, colorPalette: [...brand.colorPalette], fonts: [...brand.fonts], sizes: [...brand.sizes] };
  const snapshot = createBrandSnapshot(source);
  source.colorPalette.push('#ffffff');
  source.fonts[0] = 'Changed';
  expect(snapshot.colorPalette).toEqual(['#101010', '#f5f5f5']);
  expect(snapshot.fonts[0]).toBe('Source Han Serif');
});

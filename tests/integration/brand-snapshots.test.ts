import { expect, it } from 'vitest';

import {
  applyBrandOverride,
  adoptBrandVersion,
  createBrandSnapshot,
  getBrandFieldState,
} from '../../src/features/brands/constraints';
import {
  createRelatedDocument,
  type DesignDocument,
} from '../../src/features/projects/related-document';

const source = {
  id: 'spring',
  version: 'v1',
  logo: 'spring-mark',
  colorPalette: ['#101010'],
  fonts: ['Geist'],
  tone: 'Relaxed',
  fixedCopy: 'Bring spring home',
  sizes: ['1080x1440'],
};

it('keeps an existing project snapshot stable while exposing explicit override source and diff', () => {
  const snapshot = createBrandSnapshot(source);
  const overridden = { ...snapshot, tone: 'Formal' };
  const state = getBrandFieldState(overridden, 'tone', source);
  expect(state).toEqual({ source: 'override', value: 'Formal', base: 'Relaxed', diff: 'Relaxed → Formal' });
  source.tone = 'Bright';
  expect(snapshot.tone).toBe('Relaxed');
});

it('adopts a newer brand version only when explicitly requested', () => {
  const snapshot = createBrandSnapshot(source);
  const newer = { ...source, version: 'v2', tone: 'Bright' };
  expect(snapshot.version).toBe('v1');
  const adopted = adoptBrandVersion(snapshot, newer);
  expect(adopted.version).toBe('v2');
  expect(adopted.tone).toBe('Bright');
  expect(adopted.source).toEqual({ brandId: 'spring', version: 'v2' });
});

it('keeps a deliberate field override when adopting a newer source version', () => {
  const snapshot = applyBrandOverride(createBrandSnapshot(source), 'tone', 'Handwritten');
  const adopted = adoptBrandVersion(snapshot, { ...source, version: 'v2', tone: 'Bright' });
  expect(adopted.tone).toBe('Handwritten');
  expect(getBrandFieldState(adopted, 'tone', { ...source, tone: 'Bright' }).source).toBe('override');
});

it('copies related document source identity but keeps size and scene independent', () => {
  const original: DesignDocument = {
    id: 'poster',
    size: '1080x1440',
    scene: { layers: ['title'] },
    brandSnapshot: createBrandSnapshot(source),
  };
  const related = createRelatedDocument(original, { id: 'square', size: '1080x1080', scene: { layers: ['title', 'cta'] } });
  expect(related.brandSnapshot.source).toEqual(original.brandSnapshot.source);
  expect(related.size).toBe('1080x1080');
  expect(related.scene).not.toBe(original.scene);
  related.scene.layers.push('logo');
  expect(original.scene.layers).toEqual(['title']);
});

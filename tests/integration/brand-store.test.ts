import { expect, it } from 'vitest';

import { createBrandStore, type Brand } from '../../src/features/brands/constraints';

it('supports a complete local brand CRUD lifecycle without changing snapshots', () => {
  const brand: Brand = { id: 'local', version: 'v1', name: 'Local', logo: 'mark', colorPalette: ['#000'], fonts: ['Geist'], tone: 'Clear', fixedCopy: 'Hello', sizes: ['1080x1080'] };
  const store = createBrandStore([brand]);
  const snapshot = store.get('local');
  store.update('local', { version: 'v2', tone: 'Updated' });
  expect(snapshot?.version).toBe('v1');
  expect(store.get('local')).toMatchObject({ version: 'v2', tone: 'Updated' });
  expect(store.remove('local')).toBe(true);
  expect(store.get('local')).toBeUndefined();
});

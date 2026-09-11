import { expect, it } from 'vitest';

import { getOpenMode } from './open-mode';

it('keeps newer formats and occupied workspaces read-only', () => {
  expect(getOpenMode(3, 2, false)).toBe('read-only');
  expect(getOpenMode(2, 2, true)).toBe('read-only');
});

it('requires migration only for an older unlocked format', () => {
  expect(getOpenMode(1, 2, false)).toBe('migration-required');
  expect(getOpenMode(2, 2, false)).toBe('writable');
});

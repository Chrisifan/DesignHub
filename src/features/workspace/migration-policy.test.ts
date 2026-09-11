import { expect, it } from 'vitest';

import { canMigrate } from './migration-policy';

it('requires a verified backup, a writable lease, and a strict format upgrade', () => {
  expect(canMigrate({ backupVerified: false, writable: true, from: 1, to: 2 })).toBe(false);
  expect(canMigrate({ backupVerified: true, writable: false, from: 1, to: 2 })).toBe(false);
  expect(canMigrate({ backupVerified: true, writable: true, from: 2, to: 2 })).toBe(false);
  expect(canMigrate({ backupVerified: true, writable: true, from: 2, to: 1 })).toBe(false);
  expect(canMigrate({ backupVerified: true, writable: true, from: 1, to: 2 })).toBe(true);
});

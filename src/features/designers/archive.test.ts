import { expect, it } from 'vitest';

import {
  archiveDesigner,
  canPermanentlyRemoveDesigner,
  restoreDesigner,
} from './archive';

it('allows archive and restore state transitions for custom designers', () => {
  const designer = { status: 'published' as const, referenceCount: 2 };
  const archived = archiveDesigner(designer);

  expect(archived).toEqual({ status: 'archived', referenceCount: 2 });
  expect(designer).toEqual({ status: 'published', referenceCount: 2 });
  expect(restoreDesigner(archived)).toEqual({ status: 'published', referenceCount: 2 });
  expect(archived).toEqual({ status: 'archived', referenceCount: 2 });
});

it('prevents permanent removal while a designer has project references', () => {
  expect(canPermanentlyRemoveDesigner({ status: 'archived', referenceCount: 1 })).toBe(false);
  expect(canPermanentlyRemoveDesigner({ status: 'archived', referenceCount: 0 })).toBe(true);
});

it('only permits permanent removal from the archived state', () => {
  expect(canPermanentlyRemoveDesigner({ status: 'published', referenceCount: 0 })).toBe(false);
});

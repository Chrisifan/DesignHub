import { expect, it } from 'vitest';

import { shouldCommitText, shouldHandleCanvasShortcut } from './text-input';

it('does not commit text while an IME composition is active', () => {
  expect(shouldCommitText({ composing: true, key: 'Enter' })).toBe(false);
  expect(shouldCommitText({ composing: false, key: 'Enter' })).toBe(true);
  expect(shouldCommitText({ composing: false, key: 'a' })).toBe(false);
});

it('does not let canvas shortcuts consume composing input', () => {
  expect(shouldHandleCanvasShortcut({ composing: true, key: 'Delete' })).toBe(false);
  expect(shouldHandleCanvasShortcut({ composing: false, key: 'Delete' })).toBe(true);
});

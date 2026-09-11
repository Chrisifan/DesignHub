import { expect, it } from 'vitest';

import { canPurge } from './trash-policy';

it('does not allow purging a project with live references', () => {
  expect(canPurge(1)).toBe(false);
  expect(canPurge(0)).toBe(true);
});

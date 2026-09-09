import { expect, it } from 'vitest';

import { reuseProject } from './operation-key';

it('reuses the project from an earlier create operation', () => {
  expect(reuseProject({ 'op-1': 'project-1' }, 'op-1')).toBe('project-1');
  expect(reuseProject({ 'op-1': 'project-1' }, 'op-2')).toBeNull();
});

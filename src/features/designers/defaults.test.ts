import { expect, it } from 'vitest';

import { resolveDesigner } from './defaults';

it('uses the highest-priority configured designer that is available', () => {
  expect(resolveDesigner({
    project: 'project-v1',
    workspace: 'workspace-v1',
    global: 'global-v1',
    available: ['project-v1', 'workspace-v1', 'global-v1'],
  })).toBe('project-v1');

  expect(resolveDesigner({
    project: 'missing-project',
    workspace: 'workspace-v1',
    global: 'global-v1',
    available: ['workspace-v1', 'global-v1'],
  })).toBe('workspace-v1');
});

it('falls back through configured scopes when their snapshots are unavailable', () => {
  expect(resolveDesigner({
    project: 'missing-project',
    workspace: 'missing-workspace',
    global: 'global-v1',
    available: ['global-v1'],
  })).toBe('global-v1');

  expect(resolveDesigner({ global: 'missing', available: [] })).toBe('');
});

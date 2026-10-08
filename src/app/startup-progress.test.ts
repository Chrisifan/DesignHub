import { expect, it } from 'vitest';

import { getStartupProgress, type StartupCheck } from './startup-progress';

it('reports the percentage of startup checks that reached a terminal state', () => {
  const checks: StartupCheck[] = [
    { id: 'profile', status: 'complete' },
    { id: 'library', status: 'complete' },
    { id: 'conversation', status: 'complete' },
    { id: 'image', status: 'active' },
    { id: 'workspace', status: 'pending' },
  ];

  expect(getStartupProgress(checks)).toBe(60);
});

it('counts failed checks as completed work', () => {
  expect(getStartupProgress([
    { id: 'conversation', status: 'error' },
    { id: 'image', status: 'complete' },
  ])).toBe(100);
});

import { expect, it } from 'vitest';

import { createStartupProgressProfile, getVisualStartupProgress } from './startup-progress';

it('maps elapsed startup time to a clamped visible progress value', () => {
  const profile = createStartupProgressProfile(() => 0.5, 4);
  expect(getVisualStartupProgress(0, 2200, profile)).toBe(0);
  expect(getVisualStartupProgress(1100, 2200, profile)).toBe(50);
  expect(getVisualStartupProgress(2200, 2200, profile)).toBe(100);
  expect(getVisualStartupProgress(4000, 2200, profile)).toBe(100);
  expect(getVisualStartupProgress(-10, 2200, profile)).toBe(0);
});

it('creates monotonic progress profiles with varied speed from a random source', () => {
  const profile = createStartupProgressProfile(() => 0.1, 4);
  const variedProfile = createStartupProgressProfile((index) => index % 2 === 0 ? 0.05 : 0.95, 4);

  expect(profile).toEqual([0, 25, 50, 75, 100]);
  expect(variedProfile).not.toEqual(profile);
  expect(variedProfile[0]).toBe(0);
  expect(variedProfile.at(-1)).toBe(100);
  expect(variedProfile).toEqual([...variedProfile].sort((a, b) => a - b));
});

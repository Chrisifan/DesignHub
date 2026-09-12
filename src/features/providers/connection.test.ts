import { expect, it } from 'vitest';

import { connectionSummary } from './connection';
import { providerCapabilities } from './adapter';

it('keeps connection summaries on the public whitelist and excludes secrets', () => {
  const summary = connectionSummary({
    id: 'p1',
    label: 'Work connection',
    apiKey: 'test-secret',
  });

  expect(summary).toEqual({ id: 'p1', label: 'Work connection' });
  expect(JSON.stringify(summary)).not.toContain('test-secret');
  expect(Object.keys(summary)).toEqual(['id', 'label']);
});

it('keeps vision analysis in the provider capability contract', () => {
  expect(providerCapabilities).toContain('vision-analysis');
});

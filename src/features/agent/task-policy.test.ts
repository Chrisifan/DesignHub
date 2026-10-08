import { describe, expect, it } from 'vitest';

import { classifyTaskErrorCode } from './task-policy';

describe('classifyTaskErrorCode', () => {
  it('prefers a provider error kind', () => {
    expect(classifyTaskErrorCode({ kind: 'rate_limited', message: 'ignored' })).toBe('rate_limited');
  });

  it('maps abort errors to the canonical cancellation code', () => {
    expect(classifyTaskErrorCode({ name: 'AbortError' })).toBe('CANCELLED');
  });

  it('accepts safe uppercase error messages as codes', () => {
    expect(classifyTaskErrorCode(new Error('EMPTY_PROVIDER_RESPONSE'))).toBe('EMPTY_PROVIDER_RESPONSE');
  });

  it('falls back to provider request failure for unknown errors', () => {
    expect(classifyTaskErrorCode(new Error('network exploded'))).toBe('PROVIDER_REQUEST_FAILED');
  });
});

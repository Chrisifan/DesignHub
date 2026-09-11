import { expect, it } from 'vitest';

import { createContentSecurityPolicy } from './csp';

it('allows Vite inline styles only for the development renderer', () => {
  expect(createContentSecurityPolicy(true)).toContain(
    "style-src 'self' 'unsafe-inline'",
  );
  expect(createContentSecurityPolicy(false)).toContain("style-src 'self'");
  expect(createContentSecurityPolicy(false)).not.toContain("'unsafe-inline'");
});

import { expect, it } from 'vitest';

import { createContentSecurityPolicy } from './csp';

it('allows Vite inline styles only for the development renderer', () => {
  expect(createContentSecurityPolicy(true)).toContain(
    "style-src 'self' 'unsafe-inline'",
  );
  expect(createContentSecurityPolicy(false)).toContain("style-src 'self'");
  expect(createContentSecurityPolicy(false)).not.toContain("'unsafe-inline'");
});

it('allows managed designer artwork without permitting arbitrary remote images', () => {
  expect(createContentSecurityPolicy(false)).toContain(
    "img-src 'self' data: blob: designhub-artwork:",
  );
  expect(createContentSecurityPolicy(false)).not.toContain('https:');
});

it('allows local object URLs used to render managed image assets', () => {
  expect(createContentSecurityPolicy(false)).toContain(
    "img-src 'self' data: blob: designhub-artwork:",
  );
});

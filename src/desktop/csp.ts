const baseDirectives = [
  "default-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: designhub-artwork:",
  "script-src 'self'",
];

export const createContentSecurityPolicy = (isDevelopment: boolean): string =>
  [
    ...baseDirectives.slice(0, 3),
    `style-src 'self'${isDevelopment ? " 'unsafe-inline'" : ''}`,
    baseDirectives[3],
  ].join('; ');

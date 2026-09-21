import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readStyle = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');
const allowedRadii = new Set([
  'var(--radius-ui)',
  '0',
  '50%',
  '999px',
  'inherit',
  '45% 45% 16% 16%',
  '40% 40% 30% 30%',
  '0 55% 55% 0',
]);

const expectUnifiedRadii = (paths: readonly string[]): void => {
  const offenders = paths.flatMap((path) => {
    const source = readStyle(path);
    return Array.from(source.matchAll(/border-radius:\s*([^;]+);/gu)).flatMap((match) => {
      const value = match[1].trim();
      if (allowedRadii.has(value)) return [];
      const line = source.slice(0, match.index).split('\n').length;
      return [`${path}:${line}:${value}`];
    });
  });
  expect(offenders).toEqual([]);
};

describe('application corner radius contract', () => {
  it('defines the analysis-panel radius as the shared rectangular token', () => {
    expect(readStyle('src/app/styles/tokens.css')).toMatch(/--radius-ui:\s*10px;/u);
  });
});

export { expectUnifiedRadii };

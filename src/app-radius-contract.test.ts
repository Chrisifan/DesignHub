import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readStyle = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');
const allowedRadii = new Set([
  'var(--radius-ui)',
  'var(--radius-conversation)',
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
      const usesConversationRadiusOutsideDock =
        value === 'var(--radius-conversation)' && path !== 'src/app/studio/conversation-dock.css';
      if (allowedRadii.has(value) && !usesConversationRadiusOutsideDock) return [];
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

  it('gives only the outer conversation dock the larger shared radius', () => {
    const tokens = readStyle('src/app/styles/tokens.css');
    const conversation = readStyle('src/app/studio/conversation-dock.css');

    expect(tokens).toMatch(/--radius-conversation:\s*14px;/u);
    expect(conversation).toMatch(
      /\.conversation-dock\s*\{[^}]*border-radius:\s*var\(--radius-conversation\);/u,
    );
    expect(conversation).toMatch(
      /@media \(max-width: 720px\)\s*\{[^}]*\.conversation-dock--compact\s*\{[^}]*border-radius:\s*var\(--radius-conversation\);/u,
    );
    expect(conversation.match(/border-radius:\s*var\(--radius-conversation\);/gu)).toHaveLength(2);
  });

  it('uses the shared radius in window and studio primitives', () => {
    expectUnifiedRadii([
      'src/app/styles/window.css',
      'src/app/styles/studio.css',
    ]);
  });

  it('uses the shared radius in primary creation and editing workflows', () => {
    expectUnifiedRadii([
      'src/app/studio/studio-home.css',
      'src/app/studio/project-canvas.css',
      'src/app/studio/conversation-dock.css',
    ]);
  });

  it('uses the shared radius in designer and library surfaces', () => {
    expectUnifiedRadii([
      'src/app/studio/persona.css',
      'src/app/studio/library.css',
    ]);
  });
});

export { expectUnifiedRadii };

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/app/studio/project-canvas.css'), 'utf8');

describe('project canvas floating panel styles', () => {
  it('uses one subtle downward shadow for the conversation and analysis panels', () => {
    expect(styles).toContain('--project-canvas-panel-shadow: inset 0 1px 0 color-mix(in srgb, white 10%, transparent), 0 8px 24px rgb(15 23 42 / 10%);');
    expect(styles).toMatch(/\.project-canvas-toolbar--bottom \.conversation-dock\s*\{[^}]*box-shadow: var\(--project-canvas-panel-shadow\);/su);
    expect(styles).toMatch(/\.project-canvas-analysis-panel \.workbench-analysis-panel\s*\{[^}]*box-shadow: var\(--project-canvas-panel-shadow\);/su);
    expect(styles).toMatch(/\.project-canvas-analysis-history\s*\{[^}]*box-shadow: var\(--project-canvas-panel-shadow\);/su);
  });
});

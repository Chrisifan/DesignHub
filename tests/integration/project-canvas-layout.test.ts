import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const styles = readFileSync('src/app/studio/project-canvas.css', 'utf8');
const neuralStyles = readFileSync('src/app/previews/agent-constellation-preview.css', 'utf8');

it('places analysis panels on the right and the canvas tool rail on the left', () => {
  const analysisPanel = styles.match(/\.project-canvas-analysis-panel\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const analysisHistory = styles.match(/\.project-canvas-analysis-history\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const toolRail = [...styles.matchAll(/\.project-canvas-toolbar__actions\s*\{([\s\S]*?)\n\}/gu)]
    .map((match) => match[1])
    .join('\n');

  expect(analysisPanel).toMatch(/right:\s*16px/);
  expect(analysisPanel).not.toMatch(/left:\s*16px/);
  expect(analysisHistory).toMatch(/right:\s*16px/);
  expect(analysisHistory).not.toMatch(/left:\s*16px/);
  expect(toolRail).toMatch(/left:\s*0/);
  expect(toolRail).toMatch(/right:\s*auto/);
});

it('keeps the canvas dock and both analysis panels on the frosted glass surface', () => {
  expect(styles).toMatch(/--project-canvas-panel-background:\s*var\(--shell-glass\)/u);
  expect(styles).toMatch(/\.project-canvas-toolbar--bottom \.conversation-dock\s*\{[\s\S]*?background:\s*var\(--project-canvas-panel-background\)/u);
  expect(styles).toMatch(/\.project-canvas-analysis-panel \.workbench-analysis-panel\s*\{[\s\S]*?background:\s*var\(--project-canvas-panel-background\)[\s\S]*?backdrop-filter:\s*var\(--shell-backdrop\)/u);
  expect(styles).toMatch(/\.project-canvas-analysis-history\s*\{[\s\S]*?background:\s*var\(--project-canvas-panel-background\)[\s\S]*?backdrop-filter:\s*var\(--shell-backdrop\)/u);
});

it('defines shared analysis presence anchors and reduced-motion behavior', () => {
  expect(styles).toMatch(/\.project-canvas-analysis-presence\s*\{[\s\S]*?top:\s*calc\(100% - var\(--project-canvas-dock-bottom\) - 155px\)[\s\S]*?right:\s*16px[\s\S]*?transition:\s*top/u);
  expect(styles).toMatch(/\.project-canvas-analysis-presence--thinking\s*\{[\s\S]*?top:\s*78px/u);
  expect(styles).toMatch(/\.project-canvas-analysis-history__presence\s*\{[\s\S]*?width:\s*208px/u);
  expect(neuralStyles).toMatch(/\.neural-presence\[data-compact='true'\]\s*\{[\s\S]*?width:\s*208px/u);
  expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.project-canvas-analysis-presence/u);
});

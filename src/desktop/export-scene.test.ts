import { expect, it } from 'vitest';

import { renderSceneSvg } from './export-scene';
import { createScene } from '../features/canvas/scene';

it('renders a finite scene to an exportable SVG without leaking hidden layers', () => {
  const scene = createScene({ id: 'scene-1', width: 100, height: 100, layers: [
    { id: 'visible', type: 'text', text: '<safe>', fontFamily: 'Inter', fontSize: 20, fontWeight: 'bold', align: 'left', color: '#000', x: 4, y: 5, width: 80, height: 20, rotation: 0, opacity: 1, visible: true, locked: false },
    { id: 'hidden', type: 'text', text: 'hidden', fontFamily: 'Inter', fontSize: 20, fontWeight: 'normal', align: 'left', color: '#000', x: 4, y: 30, width: 80, height: 20, rotation: 0, opacity: 1, visible: false, locked: false },
  ] });
  const svg = renderSceneSvg(scene);
  expect(svg).toContain('&lt;safe&gt;');
  expect(svg).not.toContain('hidden');
  expect(svg).toContain('width="100"');
});

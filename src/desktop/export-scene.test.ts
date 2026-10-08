import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { expect, it, vi } from 'vitest';

import { exportSceneToFile, renderSceneSvg } from './export-scene';
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

it('does not include reference-only layers in delivery output', () => {
  const scene = createScene({ id: 'scene-reference', width: 100, height: 100, layers: [
    { id: 'reference', type: 'image', assetId: 'asset-reference', role: 'reference', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 0.55, visible: true, locked: true },
    { id: 'content', type: 'image', assetId: 'asset-content', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  const svg = renderSceneSvg(scene, new Map([
    ['asset-content', { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' }],
  ]));
  expect(svg).not.toContain('asset-reference');
  expect(svg).toContain('href="data:image/png;base64,AQID"');
  expect(svg).not.toContain('fill="#d7dce5"');
});

it('renders managed content image bytes into the exported SVG', () => {
  const scene = createScene({ id: 'scene-image', width: 120, height: 80, layers: [
    { id: 'content', type: 'image', assetId: 'asset-content', x: 5, y: 6, width: 100, height: 60, rotation: 0, opacity: 0.8, visible: true, locked: false },
  ] });

  const svg = renderSceneSvg(scene, new Map([
    ['asset-content', { bytes: new Uint8Array([137, 80, 78, 71]), mimeType: 'image/png' }],
  ]));

  expect(svg).toContain('<image');
  expect(svg).toContain('href="data:image/png;base64,iVBORw=="');
  expect(svg).toContain('x="5" y="6" width="100" height="60"');
  expect(svg).toContain('preserveAspectRatio="none"');
});

it('fails the export when a visible content image asset cannot be resolved', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-export-test-'));
  const targetPath = join(directory, 'missing.png');
  const scene = createScene({ id: 'scene-missing', width: 20, height: 20, layers: [
    { id: 'content', type: 'image', assetId: 'asset-missing', x: 0, y: 0, width: 20, height: 20, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  const resolveImageAsset = vi.fn(async () => null);

  try {
    await expect(exportSceneToFile({ scene, format: 'png', targetPath, resolveImageAsset })).rejects.toThrow('EXPORT_ASSET_MISSING');
    expect(resolveImageAsset).toHaveBeenCalledWith('asset-missing');
    await expect(readFile(targetPath)).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('exports the resolved design image instead of a placeholder rectangle', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-export-test-'));
  const targetPath = join(directory, 'design.png');
  const source = new Uint8Array(await sharp({
    create: { width: 8, height: 8, channels: 4, background: '#f20a35' },
  }).png().toBuffer());
  const scene = createScene({ id: 'scene-content', width: 8, height: 8, layers: [
    { id: 'content', type: 'image', assetId: 'asset-content', x: 0, y: 0, width: 8, height: 8, rotation: 0, opacity: 1, visible: true, locked: false },
    { id: 'reference', type: 'image', assetId: 'asset-reference', role: 'reference', x: 0, y: 0, width: 8, height: 8, rotation: 0, opacity: 1, visible: true, locked: true },
  ] });
  const resolveImageAsset = vi.fn(async (assetId: string) => assetId === 'asset-content'
    ? { bytes: source, mimeType: 'image/png' }
    : null);

  try {
    await exportSceneToFile({ scene, format: 'png', targetPath, resolveImageAsset });
    const exported = await readFile(targetPath);
    const { data, info } = await sharp(exported).raw().toBuffer({ resolveWithObject: true });
    expect(info).toMatchObject({ width: 8, height: 8 });
    expect([...data.subarray(0, 3)]).toEqual([242, 10, 53]);
    expect(resolveImageAsset).toHaveBeenCalledTimes(1);
    expect(resolveImageAsset).toHaveBeenCalledWith('asset-content');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('preserves transparent pixels when exporting a PNG scene', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-export-test-'));
  const targetPath = join(directory, 'transparent.png');
  const source = new Uint8Array(await sharp({
    create: { width: 2, height: 2, channels: 4, background: { r: 18, g: 52, b: 86, alpha: 0 } },
  }).png().toBuffer());
  const scene = createScene({ id: 'scene-transparent', width: 2, height: 2, layers: [
    { id: 'content', type: 'image', assetId: 'asset-transparent', x: 0, y: 0, width: 2, height: 2, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });

  try {
    await exportSceneToFile({
      scene,
      format: 'png',
      targetPath,
      resolveImageAsset: async () => ({ bytes: source, mimeType: 'image/png' }),
    });
    const exported = await readFile(targetPath);
    const { data, info } = await sharp(exported).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    expect(info.channels).toBe(4);
    expect(data[3]).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

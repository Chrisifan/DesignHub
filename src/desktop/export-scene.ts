import { access, rename, unlink, writeFile } from 'node:fs/promises';

import sharp from 'sharp';

import type { DesignScene } from '../features/canvas/scene';
import { exportDocument, type ExportResult } from '../features/delivery/export-document';
import { createSharpCodec } from '../features/delivery/node-codec';
import type { ExportFormat } from '../features/delivery/export-policy';

const escapeXml = (value: string): string => value.replace(/[<>&"']/gu, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character);

export type ExportImageAsset = { bytes: Uint8Array; mimeType: string };
export type ExportImageAssetResolver = (assetId: string) => Promise<ExportImageAsset | null>;

export const renderSceneSvg = (scene: DesignScene, imageAssets: ReadonlyMap<string, ExportImageAsset> = new Map()): string => {
  const layers = scene.layers.filter((layer) => layer.visible && !(layer.type === 'image' && layer.role === 'reference')).map((layer) => {
    if (layer.type === 'text') return `<text x="${layer.x}" y="${layer.y + layer.fontSize}" font-family="${escapeXml(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${escapeXml(layer.fontWeight)}" fill="${escapeXml(layer.color)}" opacity="${layer.opacity}" text-anchor="${layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start'}">${escapeXml(layer.text)}</text>`;
    if (layer.type === 'shape') return `<${layer.kind === 'ellipse' ? 'ellipse' : 'rect'} x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}"${layer.kind === 'ellipse' ? ` rx="${layer.width / 2}" ry="${layer.height / 2}"` : ''} fill="${escapeXml(layer.fill)}" stroke="${escapeXml(layer.stroke)}" stroke-width="${layer.strokeWidth}" opacity="${layer.opacity}" />`;
    const asset = imageAssets.get(layer.assetId);
    if (!asset) throw new Error('EXPORT_ASSET_MISSING');
    const href = `data:${escapeXml(asset.mimeType)};base64,${Buffer.from(asset.bytes).toString('base64')}`;
    return `<image href="${href}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" opacity="${layer.opacity}" preserveAspectRatio="none" />`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">${layers}</svg>`;
};

export const exportSceneToFile = async (input: { scene: DesignScene; format: ExportFormat; targetPath: string; background?: string; resolveImageAsset?: ExportImageAssetResolver; archiveCopy?: (input: { revisionId: string; path: string; sha256: string }) => Promise<void> }): Promise<ExportResult> => {
  const imageAssetIds = [...new Set(input.scene.layers.flatMap((layer) => (
    layer.type === 'image' && layer.visible && layer.role !== 'reference' ? [layer.assetId] : []
  )))];
  const imageAssets = new Map<string, ExportImageAsset>();
  for (const assetId of imageAssetIds) {
    const asset = await input.resolveImageAsset?.(assetId) ?? null;
    if (!asset) throw new Error('EXPORT_ASSET_MISSING');
    imageAssets.set(assetId, asset);
  }
  const codec = createSharpCodec();
  const rendered = new Uint8Array(await sharp(Buffer.from(renderSceneSvg(input.scene, imageAssets))).png().toBuffer());
  return exportDocument({
    revisionId: input.scene.id,
    format: input.format,
    targetPath: input.targetPath,
    background: input.background,
    codec,
    expectedSize: { width: input.scene.width, height: input.scene.height },
    ...(input.archiveCopy ? { archiveCopy: input.archiveCopy } : {}),
    target: {
      exists: async (path) => access(path).then(() => true).catch(() => false),
      write: async (path, bytes) => { await writeFile(path, bytes); },
      rename: async (temporaryPath, targetPath) => { await rename(temporaryPath, targetPath); },
      remove: async (path) => { await unlink(path).catch(() => undefined); },
    },
    render: async () => rendered,
  });
};

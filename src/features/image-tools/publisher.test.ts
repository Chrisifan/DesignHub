import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { publishImageResult } from './publisher';

describe('batch image publisher', () => {
  it('validates image bytes and publishes atomically into nested output paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-publish-'));
    const bytes = new Uint8Array(await sharp({ create: { width: 3, height: 4, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer());
    const result = await publishImageResult({ outputRoot: root, relativePath: 'nested/result.png', bytes });
    expect(result).toMatchObject({ width: 3, height: 4, hasAlpha: true });
    expect(new Uint8Array(await readFile(join(root, 'nested/result.png')))).toEqual(bytes);
  });

  it('does not overwrite an existing result by default and rejects invalid bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-publish-'));
    await writeFile(join(root, 'result.png'), 'existing');
    const bytes = new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).png().toBuffer());
    await expect(publishImageResult({ outputRoot: root, relativePath: 'result.png', bytes })).rejects.toThrow('OUTPUT_EXISTS');
    await expect(publishImageResult({ outputRoot: root, relativePath: 'invalid.png', bytes: new Uint8Array([1, 2, 3]) })).rejects.toThrow('IMAGE_RESULT_INVALID');
  });

  it('does not leave temporary output files when the output root cannot be created', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-publish-failure-'));
    const outputRoot = join(root, 'output-as-file');
    await writeFile(outputRoot, 'not a directory');
    const bytes = new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 4, background: '#fff' } }).png().toBuffer());
    await expect(publishImageResult({ outputRoot, relativePath: 'result.png', bytes })).rejects.toThrow();
    await expect(readdir(root)).resolves.toEqual(['output-as-file']);
    await rm(root, { recursive: true, force: true });
  });
});

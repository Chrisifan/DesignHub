import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { scanImageSources } from './scanner';

const image = async (path: string): Promise<void> => writeFile(path, await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ff0000' } }).png().toBuffer());

describe('batch image scanner', () => {
  it('scans nested supported images and reports unsupported files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scan-'));
    await writeFile(join(root, 'notes.txt'), 'not an image');
    await import('node:fs/promises').then(({ mkdir }) => mkdir(join(root, 'nested')));
    await image(join(root, 'nested', 'source.png'));
    const result = await scanImageSources({ sourcePath: root, outputRoot: `${root}-out`, tool: 'format-convert', outputFormat: 'webp' });
    expect(result.accepted.map((entry) => entry.relativePath)).toEqual(['nested/source.png']);
    expect(result.outputPaths).toEqual([`${root}-out/nested/source.webp`]);
    expect(result.rejected).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'notes.txt', code: 'UNSUPPORTED_FORMAT' })]));
  });

  it('does not follow symlinks and rejects output collisions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scan-'));
    await image(join(root, 'a.png'));
    await image(join(root, 'a.jpg'));
    await symlink(join(root, 'a.png'), join(root, 'linked.png'));
    const result = await scanImageSources({ sourcePath: root, outputRoot: `${root}-out`, tool: 'format-convert', outputFormat: 'png' });
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OUTPUT_COLLISION' }),
      expect.objectContaining({ path: 'linked.png', code: 'SYMLINK_NOT_ALLOWED' }),
    ]));
  });

  it('rejects an output directory inside the source tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scan-'));
    await expect(scanImageSources({ sourcePath: root, outputRoot: join(root, 'out') })).rejects.toThrow('IMAGE_TOOL_JOB_ROOTS_INVALID');
  });

  it('reports empty directories without creating an executable input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-empty-'));
    const result = await scanImageSources({ sourcePath: root, outputRoot: `${root}-out` });
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([expect.objectContaining({ code: 'EMPTY_DIRECTORY' })]);
  });

  it('uses the containing directory as the source root for a single file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-file-'));
    const source = join(root, 'single.png');
    await image(source);
    const result = await scanImageSources({ sourcePath: source, outputRoot: `${root}-out`, tool: 'resize', outputFormat: 'png' });
    expect(result.sourceRoot).toBe(root);
    expect(result.accepted[0]?.relativePath).toBe('single.png');
  });
});

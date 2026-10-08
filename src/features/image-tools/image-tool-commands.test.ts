import { expect, it, vi } from 'vitest';

import { createImageToolCommands } from './image-tool-commands';

it('routes batch actions without changing their typed payloads', async () => {
  const scan = vi.fn(async () => ({ accepted: [{ relativePath: 'one.png' }], rejected: [] }));
  const create = vi.fn(async () => undefined);
  const pause = vi.fn(async () => undefined);
  const commands = createImageToolCommands({ scan, create, pause });

  await expect(commands.scan({ tool: 'resize', params: { width: 100, height: 100 }, sourcePath: '/source', outputRoot: '/output' })).resolves.toEqual({ accepted: [{ relativePath: 'one.png' }], rejected: [] });
  await commands.create({ tool: 'resize', params: { width: 100, height: 100 }, sourcePath: '/source', outputRoot: '/output' });
  await commands.pause('job-1');

  expect(scan).toHaveBeenCalledWith({ tool: 'resize', params: { width: 100, height: 100 }, sourcePath: '/source', outputRoot: '/output' });
  expect(create).toHaveBeenCalledWith({ tool: 'resize', params: { width: 100, height: 100 }, sourcePath: '/source', outputRoot: '/output' });
  expect(pause).toHaveBeenCalledWith('job-1');
});

it('keeps optional result actions safe when the host does not provide them', async () => {
  const commands = createImageToolCommands({});
  await expect(commands.openResult('/output/one.png', 'job-1')).resolves.toBeUndefined();
  await expect(commands.revealResult('/output/one.png', 'job-1')).resolves.toBeUndefined();
  await expect(commands.importResult('/output/one.png', 'job-1')).resolves.toBeUndefined();
});

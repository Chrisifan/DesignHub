import { expect, it } from 'vitest';
import { executeTool } from '../../src/features/image-tools/execute-tool';

it('runs resize locally without a provider connection', async () => {
  const result = await executeTool({
    documentId: 'doc-1', baseRevisionId: 'rev-1', targetLayerId: 'layer-1',
    tool: 'resize', params: { width: 800, height: 600, format: 'png' },
  }, { getLayer: () => ({ id: 'layer-1', width: 1000, height: 1000 }), applyLocal: async (input) => ({ ...input, revisionId: 'rev-2' }) });
  expect(result.revisionId).toBe('rev-2');
});

it('rejects regional tools without an in-bounds region', async () => {
  await expect(executeTool({
    documentId: 'doc-1', baseRevisionId: 'rev-1', targetLayerId: 'layer-1',
    tool: 'remove-object', params: {},
  }, { getLayer: () => ({ id: 'layer-1', width: 100, height: 100 }) })).rejects.toThrow('REGION_REQUIRED');
});

it('requires a connection for model-backed tools', async () => {
  await expect(executeTool({
    documentId: 'doc-1', baseRevisionId: 'rev-1', targetLayerId: 'layer-1',
    tool: 'upscale', params: { scale: 2 },
  }, { getLayer: () => ({ id: 'layer-1', width: 100, height: 100 }) })).rejects.toThrow('CONNECTION_REQUIRED');
});

it('rejects a tool when its provider capability is unavailable', async () => {
  await expect(executeTool({
    documentId: 'doc-1', baseRevisionId: 'rev-1', targetLayerId: 'layer-1',
    tool: 'upscale', params: { scale: 2 }, connectionId: 'provider-1',
  }, { getLayer: () => ({ id: 'layer-1', width: 100, height: 100 }), capabilities: ['image-generation'] })).rejects.toThrow('CAPABILITY_UNAVAILABLE');
});

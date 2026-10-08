import { expect, it } from 'vitest';

import { createImageTaskRecord } from './task-record-factory';

it('normalizes an image task into a running TaskRecord without losing tool metadata', () => {
  const task = createImageTaskRecord({
    id: 'image-task-1',
    requestId: 'request-1',
    requestText: 'remove the background',
    source: { kind: 'project', id: 'project-1' },
    documentId: 'document-1',
    baseRevisionId: 'revision-1',
    connectionId: 'connection-1',
    model: 'image-model-1',
    size: '1024x1024',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
    sourceAssetId: 'asset-source',
    maskAssetId: 'asset-mask',
    region: { x: 0.1, y: 0.2, width: 0.4, height: 0.5 },
    hasMask: true,
    capability: 'image-editing',
  });

  expect(task).toMatchObject({
    id: 'image-task-1',
    requestId: 'request-1',
    state: 'running',
    cancelRequested: false,
    attempt: 1,
    source: { kind: 'project', id: 'project-1' },
    documentId: 'document-1',
    baseRevisionId: 'revision-1',
    providerId: 'connection-1',
    model: 'image-model-1',
    size: '1024x1024',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
    sourceAssetId: 'asset-source',
    maskAssetId: 'asset-mask',
    region: { x: 0.1, y: 0.2, width: 0.4, height: 0.5 },
    hasMask: true,
    capability: 'image-editing',
  });
});

it('rejects image tasks without a project document binding', () => {
  expect(() => createImageTaskRecord({
    id: 'image-task-2',
    requestId: 'request-2',
    requestText: 'edit this image',
    source: { kind: 'project', id: 'project-1' },
    connectionId: 'connection-1',
    capability: 'image-editing',
  })).toThrow('IMAGE_TASK_BINDING_REQUIRED');
});

it('rejects invalid tool parameters before a task is created', () => {
  expect(() => createImageTaskRecord({
    id: 'image-task-3',
    requestId: 'request-3',
    requestText: 'resize this image',
    source: { kind: 'project', id: 'project-1' },
    documentId: 'document-1',
    connectionId: 'connection-1',
    capability: 'image-editing',
    tool: 'resize',
    toolParams: { width: -1, height: 0 },
  })).toThrow('INVALID_PARAMS');
});

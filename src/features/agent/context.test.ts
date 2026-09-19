import { expect, it } from 'vitest';

import { buildDesignContextPrompt, selectContextAssets, type DesignGenerationContext } from './context';

it('does not implicitly read another project in the workspace', () => {
  const assets = [{ id: 'a', projectId: 'p1' }, { id: 'b', projectId: 'p2' }];

  expect(selectContextAssets(assets, 'p1', ['a', 'b'], [])).toEqual(['a']);
  expect(selectContextAssets(assets, 'p1', [], ['b'])).toEqual(['b']);
});
it('does not upload unrequested project assets', () => {
  const assets = [
    { id: 'a', projectId: 'p1' },
    { id: 'b', projectId: 'p1' },
    { id: 'c', projectId: 'p2' },
  ];

  expect(selectContextAssets(assets, 'p1', [], [])).toEqual([]);
  expect(selectContextAssets(assets, 'p1', ['a'], [])).toEqual(['a']);
});

it('serializes the project and designer context without credentials', () => {
  const context: DesignGenerationContext = {
    version: 1,
    workspaceId: 'w1',
    projectId: 'p1',
    documentId: 'd1',
    brief: 'Spring market poster',
    document: { width: 1080, height: 1440, currentImageAssetIds: ['canvas-image'] },
    attachmentAssetIds: ['reference-image'],
    userMessage: 'Make the title calmer',
    assistantBrief: 'Use a restrained editorial hierarchy.',
    designerSnapshot: {
      id: 'designer-v1',
      name: { zh: '纸感排版', en: 'Paper & Type' },
      styleDna: { palette: ['#fff'], typography: { zh: '衬线', en: 'Serif' } },
      negativeRules: [{ zh: '避免霓虹', en: 'Avoid neon' }],
    },
    brandSnapshot: { version: 'brand-v2', secret: 'must-not-ship' },
    baseRevisionId: 'revision-1',
  };

  const prompt = buildDesignContextPrompt(context);
  expect(prompt).toContain('Spring market poster');
  expect(prompt).toContain('Paper & Type');
  expect(prompt).toContain('Avoid neon');
  expect(prompt).not.toContain('must-not-ship');
});

it('omits designer style instructions when a project has no designer', () => {
  const prompt = buildDesignContextPrompt({
    version: 1,
    workspaceId: 'w1',
    projectId: 'p1',
    documentId: 'd1',
    brief: 'A blank project',
    document: { width: 1080, height: 1080, currentImageAssetIds: [] },
    attachmentAssetIds: [],
    userMessage: 'Create a first draft',
    baseRevisionId: null,
  });

  expect(prompt).not.toContain('Designer profile');
  expect(prompt).not.toContain('styleDna');
  expect(prompt).not.toContain('negative rules');
});

import { expect, it } from 'vitest';

import { createProjectMetadata, migrateLegacyProjectMetadata, updateProjectMetadata, type ProjectMetadata } from './metadata';

it('creates a project design collection and canvas layout snapshot', () => {
  const metadata = createProjectMetadata({
    projectId: 'project-1',
    name: 'Canvas project',
    workspaceId: 'workspace-1',
    designs: [{ id: 'design-1', assetId: 'asset-123', sourceTaskId: 'task-1', width: 1080, height: 1440, title: 'Poster', createdAt: '2026-09-21T00:00:00.000Z' }],
    canvasLayout: { viewport: { zoom: 1, offsetX: 0, offsetY: 0 }, nodes: { 'design-1': { x: 40, y: 60 } } },
  });

  expect(metadata.designs).toHaveLength(1);
  expect(metadata.designs?.[0]).toMatchObject({ id: 'design-1', assetId: 'asset-123', width: 1080, height: 1440 });
  expect(metadata.canvasLayout?.nodes['design-1']).toEqual({ x: 40, y: 60 });
});

it('rejects invalid or duplicate project designs', () => {
  expect(() => createProjectMetadata({
    projectId: 'project-1', name: 'Canvas project', workspaceId: 'workspace-1',
    designs: [{ id: 'design-1', assetId: '', sourceTaskId: 'task-1', width: 1080, height: 1440, title: 'Poster', createdAt: '2026-09-21T00:00:00.000Z' }],
  })).toThrow('INVALID_PROJECT_DESIGN');
  expect(() => createProjectMetadata({
    projectId: 'project-1', name: 'Canvas project', workspaceId: 'workspace-1',
    designs: [
      { id: 'design-1', assetId: 'asset-1', sourceTaskId: 'task-1', width: 1080, height: 1440, title: 'Poster', createdAt: '2026-09-21T00:00:00.000Z' },
      { id: 'design-1', assetId: 'asset-2', sourceTaskId: 'task-2', width: 1080, height: 1440, title: 'Poster 2', createdAt: '2026-09-21T00:00:00.000Z' },
    ],
  })).toThrow('INVALID_PROJECT_DESIGN');
});

it('rejects the removed document metadata contract', () => {
  expect(() => createProjectMetadata({
    projectId: 'project-1',
    name: '春间市集',
    workspaceId: 'workspace-1',
    brief: '春日活动视觉',
    documents: [{ id: 'doc-1', name: '主海报', width: 1080, height: 1440 }],
  } as never)).toThrow('DOCUMENT_SCHEMA_REMOVED');
});

it('updates metadata without changing the previous snapshot', () => {
  const initial = createProjectMetadata({ projectId: 'project-1', name: '旧名称', workspaceId: 'workspace-1', generationRatio: '1:1' });
  const updated = updateProjectMetadata(initial, { name: '新名称', archived: true, activeDesignerVersionId: 'designer-v2', generationRatio: '16:9' });
  expect(initial).toMatchObject({ name: '旧名称', archived: false, generationRatio: '1:1' });
  expect(updated).toMatchObject({ name: '新名称', archived: true, activeDesignerVersionId: 'designer-v2', generationRatio: '16:9' });
  expect(updated.updatedAt).not.toBe(initial.updatedAt);
});

it('defaults project generation ratio to the original image', () => {
  expect(createProjectMetadata({ projectId: 'project-1', name: '项目', workspaceId: 'workspace-1' }).generationRatio).toBe('original');
});

it('rejects an empty project name and removed document fields', () => {
  expect(() => createProjectMetadata({ projectId: 'project-1', name: ' ', workspaceId: 'workspace-1' })).toThrow('INVALID_PROJECT_METADATA');
  expect(() => createProjectMetadata({ projectId: 'project-1', name: 'Valid', workspaceId: 'workspace-1', documentId: 'doc-1' } as never)).toThrow('DOCUMENT_SCHEMA_REMOVED');
});

it('keeps designer snapshots immutable when updated', () => {
  const designer = { versionId: 'v1', name: '纸感排版', rules: ['保留留白'] };
  const metadata = createProjectMetadata({ projectId: 'project-1', name: '项目', workspaceId: 'workspace-1', designerSnapshot: designer });
  designer.rules.push('暖色');
  expect(metadata.designerSnapshot).toEqual({ versionId: 'v1', name: '纸感排版', rules: ['保留留白'] });
});

it('removes legacy brand snapshots while migrating project metadata', () => {
  expect(migrateLegacyProjectMetadata({ projectId: 'project-1', brandSnapshot: { version: 'v2' } })).toEqual({ projectId: 'project-1' });
});

it('always includes the active designer as the first contributor', () => {
  const metadata = createProjectMetadata({
    projectId: 'project-1',
    name: '项目',
    workspaceId: 'workspace-1',
    activeDesignerVersionId: 'designer-a',
    contributorDesignerVersionIds: ['designer-b', 'designer-a', 'designer-b'],
  });
  expect(metadata.contributorDesignerVersionIds).toEqual(['designer-a', 'designer-b']);
});

it('moves a switched active designer to the lead without dropping existing contributors', () => {
  const initial = createProjectMetadata({
    projectId: 'project-1',
    name: '项目',
    workspaceId: 'workspace-1',
    activeDesignerVersionId: 'designer-a',
    contributorDesignerVersionIds: ['designer-a', 'designer-b'],
  });
  const updated = updateProjectMetadata(initial, { activeDesignerVersionId: 'designer-c' });
  expect(updated.contributorDesignerVersionIds).toEqual(['designer-c', 'designer-a', 'designer-b']);
});

it('preserves an optional managed cover asset id', () => {
  const created = createProjectMetadata({
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    name: '项目',
    coverAssetId: 'asset-0123456789abcdef',
  });

  expect(created.coverAssetId).toBe('asset-0123456789abcdef');
  expect(createProjectMetadata({ projectId: 'project-2', workspaceId: 'workspace-1', name: '旧项目' })).not.toHaveProperty('coverAssetId');
  expect(updateProjectMetadata(created, { coverAssetId: 'asset-fedcba9876543210' }).coverAssetId).toBe('asset-fedcba9876543210');
});

const _typeCheck = (value: ProjectMetadata): ProjectMetadata => value;
void _typeCheck;

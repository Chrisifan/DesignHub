import { expect, it } from 'vitest';

import { createProjectMetadata, updateProjectMetadata, type ProjectMetadata } from './metadata';

it('creates a project metadata snapshot with an independent document list', () => {
  const documents = [{ id: 'doc-1', name: '主海报', width: 1080, height: 1440 }];
  const metadata = createProjectMetadata({
    projectId: 'project-1',
    name: '春间市集',
    workspaceId: 'workspace-1',
    brief: '春日活动视觉',
    documents,
  });
  documents[0].name = '被修改';
  expect(metadata).toMatchObject({ projectId: 'project-1', name: '春间市集', workspaceId: 'workspace-1', brief: '春日活动视觉' });
  expect(metadata.documents[0].name).toBe('主海报');
});

it('updates metadata without changing the previous snapshot', () => {
  const initial = createProjectMetadata({ projectId: 'project-1', name: '旧名称', workspaceId: 'workspace-1' });
  const updated = updateProjectMetadata(initial, { name: '新名称', archived: true, activeDesignerVersionId: 'designer-v2' });
  expect(initial).toMatchObject({ name: '旧名称', archived: false });
  expect(updated).toMatchObject({ name: '新名称', archived: true, activeDesignerVersionId: 'designer-v2' });
  expect(updated.updatedAt).not.toBe(initial.updatedAt);
});

it('rejects an empty project name and invalid document dimensions', () => {
  expect(() => createProjectMetadata({ projectId: 'project-1', name: ' ', workspaceId: 'workspace-1' })).toThrow('INVALID_PROJECT_METADATA');
  expect(() => createProjectMetadata({ projectId: 'project-1', name: 'Valid', workspaceId: 'workspace-1', documents: [{ id: 'doc-1', name: 'Poster', width: 0, height: 100 }] })).toThrow('INVALID_DOCUMENT');
});

it('rejects duplicate or path-like document identities', () => {
  expect(() => createProjectMetadata({ projectId: 'project-1', name: 'Valid', workspaceId: 'workspace-1', documents: [
    { id: 'doc-1', name: 'Poster', width: 100, height: 100 },
    { id: 'doc-1', name: 'Square', width: 100, height: 100 },
  ] })).toThrow('INVALID_DOCUMENT');
  expect(() => createProjectMetadata({ projectId: 'project-1', name: 'Valid', workspaceId: 'workspace-1', documents: [
    { id: '../outside', name: 'Poster', width: 100, height: 100 },
  ] })).toThrow('INVALID_DOCUMENT');
});

it('keeps designer and brand snapshots immutable when updated', () => {
  const designer = { versionId: 'v1', name: '纸感排版', rules: ['保留留白'] };
  const brand = { version: 'v2', colors: ['#fff'] };
  const metadata = createProjectMetadata({ projectId: 'project-1', name: '项目', workspaceId: 'workspace-1', designerSnapshot: designer, brandSnapshot: brand });
  designer.rules.push('暖色');
  brand.colors[0] = '#000';
  expect(metadata.designerSnapshot).toEqual({ versionId: 'v1', name: '纸感排版', rules: ['保留留白'] });
  expect(metadata.brandSnapshot).toEqual({ version: 'v2', colors: ['#fff'] });
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

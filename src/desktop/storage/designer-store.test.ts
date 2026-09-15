// @vitest-environment node

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createWorkspace, openWorkspace } from './workspace-store';
import * as designerStore from './designer-store';
import { designersFileName, loadDesignerState, saveDesignerState } from './designer-store';
import { personaProfiles } from '../../../tests/fixtures/personas';

const temporaryDirectories: string[] = [];

const createTemporaryWorkspace = async () => {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'designhub-designer-store-'));
  temporaryDirectories.push(parentDirectory);
  return createWorkspace({ parentDirectory, name: 'workspace' });
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('persists designer profiles, defaults and drafts across workspace reopen', async () => {
  const workspace = await createTemporaryWorkspace();
  const state = { profiles: [], defaultId: 'builtin-v1', drafts: { newDraft: { name: '未完成档案' } } };
  await saveDesignerState(workspace, workspace.workspace.workspaceId, state);
  const normalizedState = { ...state, defaultId: '' };
  const filePath = join(workspace.workspace.directory, '.designhub', designersFileName);
  expect(existsSync(filePath)).toBe(true);
  expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(normalizedState);
  workspace.close();

  const reopened = await openWorkspace(workspace.workspace.directory);
  try {
    await expect(loadDesignerState(reopened, reopened.workspace.workspaceId)).resolves.toEqual(normalizedState);
  } finally {
    reopened.close();
  }
});

it('returns no state for malformed data and refuses writes in read-only workspaces', async () => {
  const workspace = await createTemporaryWorkspace();
  const filePath = join(workspace.workspace.directory, '.designhub', designersFileName);
  await saveDesignerState(workspace, workspace.workspace.workspaceId, { profiles: [], defaultId: 'builtin-v1' });
  await writeFile(filePath, '{bad json', 'utf8');
  await expect(loadDesignerState(workspace, workspace.workspace.workspaceId)).rejects.toThrow('INVALID_DESIGNER_STATE');
  const reopened = await openWorkspace(workspace.workspace.directory);
  try {
    await expect(saveDesignerState(reopened, reopened.workspace.workspaceId, { profiles: [], defaultId: 'builtin-v1' })).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
  } finally {
    reopened.close();
    workspace.close();
  }
});

it('rejects a symlinked designer state instead of reading outside the workspace', async () => {
  const workspace = await createTemporaryWorkspace();
  const filePath = join(workspace.workspace.directory, '.designhub', designersFileName);
  const externalPath = join(workspace.workspace.directory, '..', 'external-designers.json');
  await writeFile(externalPath, JSON.stringify({ profiles: [], defaultId: 'builtin-v1' }), 'utf8');
  await symlink(externalPath, filePath);
  await expect(loadDesignerState(workspace, workspace.workspace.workspaceId)).rejects.toThrow('INVALID_DESIGNER_STATE');
  workspace.close();
});

it('persists generated artwork bytes separately from designer profile metadata', async () => {
  const workspace = await createTemporaryWorkspace();
  const artworkStore = designerStore as typeof designerStore & {
    saveDesignerArtwork: (handle: Awaited<ReturnType<typeof createTemporaryWorkspace>>, workspaceId: string, artworkId: string, bytes: Uint8Array, mimeType: string) => Promise<{ artworkId: string }>;
    readDesignerArtwork: (handle: Awaited<ReturnType<typeof createTemporaryWorkspace>>, workspaceId: string, artworkId: string) => Promise<{ artworkId: string; dataUrl: string } | null>;
  };
  expect(artworkStore.saveDesignerArtwork).toBeTypeOf('function');
  expect(artworkStore.readDesignerArtwork).toBeTypeOf('function');
  await expect(artworkStore.saveDesignerArtwork(
    workspace,
    workspace.workspace.workspaceId,
    'artwork-portrait-1',
    new Uint8Array([1, 2, 3]),
    'image/png',
  )).resolves.toEqual({ artworkId: 'artwork-portrait-1' });
  workspace.close();

  const reopened = await openWorkspace(workspace.workspace.directory);
  try {
    await expect(artworkStore.readDesignerArtwork(
      reopened,
      reopened.workspace.workspaceId,
      'artwork-portrait-1',
    )).resolves.toEqual({
      artworkId: 'artwork-portrait-1',
      dataUrl: 'data:image/png;base64,AQID',
    });
  } finally {
    reopened.close();
  }
});

it('rewrites removed preview seed profiles when a writable workspace is opened', async () => {
  const workspace = await createTemporaryWorkspace();
  const filePath = join(workspace.workspace.directory, '.designhub', designersFileName);
  const legacy = structuredClone(personaProfiles.find((profile) => profile.id === 'paper-type'));
  const custom = legacy ? { ...legacy, id: 'custom-designer', status: 'draft' as const } : null;
  if (!legacy || !custom) throw new Error('fixture missing');
  await writeFile(filePath, JSON.stringify({ profiles: [legacy, custom], defaultId: legacy.id }), 'utf8');

  await expect(loadDesignerState(workspace, workspace.workspace.workspaceId)).resolves.toMatchObject({
    profiles: [expect.objectContaining({ id: 'custom-designer' })],
    defaultId: '',
  });
  expect(JSON.parse(await readFile(filePath, 'utf8'))).toMatchObject({
    profiles: [expect.objectContaining({ id: 'custom-designer' })],
    defaultId: '',
  });
});

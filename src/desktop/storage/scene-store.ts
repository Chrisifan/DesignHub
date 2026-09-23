import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import { parseScene, serializeScene, type DesignScene } from '../../features/canvas/scene';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { getWritableProjectLibraryLease } from './project-library-store';
import { resolveProjectDirectory } from './project-store';

const documentIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u;
const documentsDirectoryName = 'documents';

const validateDocumentId = (documentId: string): string => {
  if (!documentIdPattern.test(documentId)) throw new Error('INVALID_DOCUMENT_ID');
  return documentId;
};

export const sceneFileName = (documentId: string): string => `${validateDocumentId(documentId)}.scene.json`;

const getProjectDirectory = (handle: ProjectLibraryHandle, workspaceId: string, projectId: string, writable: boolean): string => {
  if (handle.library.libraryId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (writable && !getWritableProjectLibraryLease(handle)) throw new Error('WORKSPACE_NOT_WRITABLE');
  const directory = resolveProjectDirectory(handle, projectId);
  if (!directory) throw new Error('PROJECT_NOT_FOUND');
  return directory;
};

const getDocumentsDirectory = async (projectDirectory: string, writable: boolean): Promise<string> => {
  const directory = join(projectDirectory, documentsDirectoryName);
  if (writable) {
    try {
      const status = lstatSync(directory);
      if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory) throw new Error('INVALID_PROJECT_PATH');
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_PROJECT_PATH') throw error;
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code !== 'ENOENT') throw error;
      await mkdir(directory, { recursive: false });
    }
    return directory;
  }
  try {
    const status = lstatSync(directory);
    if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory) throw new Error('INVALID_PROJECT_PATH');
    return directory;
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PROJECT_PATH') throw error;
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === 'ENOENT') return directory;
    throw error;
  }
};

export const loadDocumentScene = async (
  handle: ProjectLibraryHandle,
  workspaceId: string,
  projectId: string,
  documentId: string,
): Promise<DesignScene | null> => {
  validateDocumentId(documentId);
  let projectDirectory: string;
  try {
    projectDirectory = getProjectDirectory(handle, workspaceId, projectId, false);
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') return null;
    throw error;
  }
  const directory = await getDocumentsDirectory(projectDirectory, false);
  const path = join(directory, sceneFileName(documentId));
  try {
    await access(path, constants.R_OK);
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_SCENE_FILE');
    return parseScene(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && (error.message === 'INVALID_SCENE' || error.message === 'INVALID_SCENE_FILE' || error.message === 'INVALID_PROJECT_PATH')) {
      if (error.message === 'INVALID_PROJECT_PATH') throw error;
      return null;
    }
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    if (code === 'ENOENT') return null;
    throw error;
  }
};

export const saveDocumentScene = async (
  handle: ProjectLibraryHandle,
  workspaceId: string,
  projectId: string,
  documentId: string,
  scene: DesignScene,
): Promise<boolean> => {
  validateDocumentId(documentId);
  const projectDirectory = getProjectDirectory(handle, workspaceId, projectId, true);
  const directory = await getDocumentsDirectory(projectDirectory, true);
  const serialized = `${serializeScene(scene)}\n`;
  const destination = join(directory, sceneFileName(documentId));
  const temporary = join(directory, `.${sceneFileName(documentId)}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};

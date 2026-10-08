import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { link, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';

import { createProjectPackage, encodeProjectPackage } from '../../features/delivery/project-package';
import { classifyPackageEntry, type PackageEntryKind } from '../../features/delivery/package-policy';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { resolveProjectDirectory } from './project-store';

type ProjectPackageArchiveOptions = {
  packageId?: string;
};

const collectProjectPackageEntries = (projectDirectory: string): Array<{ path: string; bytes: Uint8Array; kind: PackageEntryKind }> => {
  const entries: Array<{ path: string; bytes: Uint8Array; kind: PackageEntryKind }> = [];
  const visit = (directory: string): void => {
    readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((entry) => {
        const path = join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('INVALID_PROJECT_PACKAGE_SOURCE');
        if (entry.isDirectory()) {
          visit(path);
          return;
        }
        if (!entry.isFile()) throw new Error('INVALID_PROJECT_PACKAGE_SOURCE');
        const relativePath = relative(projectDirectory, path).split(sep).join('/');
        entries.push({ path: relativePath, bytes: new Uint8Array(readFileSync(path)), kind: classifyPackageEntry(relativePath) });
      });
  };
  visit(projectDirectory);
  return entries;
};

export const createProjectPackageArchive = async (
  handle: ProjectLibraryHandle,
  projectId: string,
  options: ProjectPackageArchiveOptions = {},
): Promise<{ packageId: string; archive: Uint8Array; sha256: string }> => {
  const projectDirectory = resolveProjectDirectory(handle, projectId);
  if (!projectDirectory) throw new Error('PROJECT_NOT_FOUND');
  const packageId = options.packageId ?? randomUUID();
  const pack = await createProjectPackage({
    packageId,
    projectId,
    entries: collectProjectPackageEntries(projectDirectory),
  });
  const archive = await encodeProjectPackage(pack);
  return {
    packageId,
    archive,
    sha256: createHash('sha256').update(archive).digest('hex'),
  };
};

const errorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
};

export const writeProjectPackageArchive = async (targetPath: string, archive: Uint8Array): Promise<void> => {
  const temporaryPath = join(dirname(targetPath), `.${basename(targetPath)}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporaryPath, archive, { flag: 'wx' });
    await link(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (errorCode(error) === 'EEXIST') throw new Error('TARGET_EXISTS');
    throw error;
  }
  await rm(temporaryPath, { force: true }).catch(() => undefined);
};

import { createHash } from 'node:crypto';
import { closeSync, createReadStream, mkdirSync, openSync, writeSync } from 'node:fs';
import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';

import { Unzip, UnzipInflate } from 'fflate';

import { decodeProjectPackageManifest, projectPackageManifestPath } from '../../features/delivery/project-package';
import { isSafePackagePath } from '../../features/delivery/package-policy';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { importExtractedProjectPackageToWorkspace } from './project-store';

export type ProjectPackageArchiveImportInput = {
  libraryId: string;
  operationId: string;
  archivePath: string;
};

export type ProjectPackageImportLimits = {
  maxArchiveBytes: number;
  maxEntries: number;
  maxEntryBytes: number;
  maxExpandedBytes: number;
  maxCompressionRatio: number;
  maxManifestBytes: number;
};

const defaultLimits: ProjectPackageImportLimits = {
  maxArchiveBytes: 512 * 1024 * 1024,
  maxEntries: 4096,
  maxEntryBytes: 512 * 1024 * 1024,
  maxExpandedBytes: 2 * 1024 * 1024 * 1024,
  maxCompressionRatio: 100,
  maxManifestBytes: 1024 * 1024,
};

const invalidPackage = (): Error => new Error('INVALID_PACKAGE');

const resolveEntryPath = (directory: string, path: string): string => {
  if (!isSafePackagePath(path)) throw invalidPackage();
  const target = join(directory, path);
  const relativeTarget = relative(directory, target);
  if (!relativeTarget || relativeTarget === '..' || relativeTarget.startsWith(`..${sep}`) || relativeTarget.includes(`..${sep}`)) {
    throw invalidPackage();
  }
  return target;
};

const extractArchive = async (
  archivePath: string,
  destination: string,
  limits: ProjectPackageImportLimits,
): Promise<{ names: Set<string>; contentHashes: Map<string, string>; expandedBytes: number; archiveBytes: number }> => {
  const archiveStatus = await lstat(archivePath).catch(() => null);
  if (!archiveStatus?.isFile() || archiveStatus.isSymbolicLink() || archiveStatus.size <= 0 || archiveStatus.size > limits.maxArchiveBytes) {
    throw invalidPackage();
  }
  const names = new Set<string>();
  const contentHashes = new Map<string, string>();
  const openFiles = new Set<number>();
  const maxRatioBytes = Math.max(limits.maxManifestBytes, archiveStatus.size * limits.maxCompressionRatio);
  let expandedBytes = 0;
  let archiveBytes = 0;
  let failure: Error | null = null;

  const closeFile = (descriptor: number): void => {
    if (!openFiles.delete(descriptor)) return;
    closeSync(descriptor);
  };
  const fail = (error: Error = invalidPackage()): void => {
    failure ??= error;
  };

  const unzip = new Unzip((entry) => {
    if (failure) return;
    if (names.size >= limits.maxEntries || names.has(entry.name)) {
      fail();
      return;
    }
    let target: string;
    try { target = resolveEntryPath(destination, entry.name); } catch (error) { fail(error as Error); return; }
    if (entry.originalSize !== undefined && entry.originalSize > limits.maxEntryBytes) {
      fail(new Error('PROJECT_PACKAGE_LIMIT'));
      return;
    }
    names.add(entry.name);
    mkdirSync(dirname(target), { recursive: true });
    let descriptor: number;
    try {
      descriptor = openSync(target, 'wx');
      openFiles.add(descriptor);
    } catch {
      fail();
      return;
    }
    let entryBytes = 0;
    const hash = createHash('sha256');
    entry.ondata = (error, chunk, final) => {
      if (error || failure) {
        fail();
        closeFile(descriptor);
        return;
      }
      entryBytes += chunk.byteLength;
      expandedBytes += chunk.byteLength;
      if (entryBytes > limits.maxEntryBytes || expandedBytes > limits.maxExpandedBytes || expandedBytes > maxRatioBytes) {
        fail(new Error('PROJECT_PACKAGE_LIMIT'));
        closeFile(descriptor);
        entry.terminate();
        return;
      }
      if (chunk.byteLength > 0) {
        let offset = 0;
        while (offset < chunk.byteLength) {
          const written = writeSync(descriptor, chunk, offset);
          if (written <= 0) throw new Error('PROJECT_PACKAGE_WRITE_FAILED');
          offset += written;
        }
        hash.update(chunk);
      }
      if (!final) return;
      closeFile(descriptor);
      if (entry.originalSize !== undefined && entry.originalSize !== entryBytes) fail();
      else contentHashes.set(entry.name, hash.digest('hex'));
    };
    try { entry.start(); } catch { closeFile(descriptor); fail(); }
  });
  unzip.register(UnzipInflate);

  try {
    for await (const chunk of createReadStream(archivePath, { highWaterMark: 64 * 1024 })) {
      const bytes = chunk as Uint8Array;
      archiveBytes += bytes.byteLength;
      if (archiveBytes > limits.maxArchiveBytes) throw new Error('PROJECT_PACKAGE_LIMIT');
      unzip.push(bytes, false);
      if (failure) throw failure;
    }
    unzip.push(new Uint8Array(), true);
    if (failure) throw failure;
    if (openFiles.size > 0 || archiveBytes !== archiveStatus.size) throw invalidPackage();
    return { names, contentHashes, expandedBytes, archiveBytes };
  } catch (error) {
    throw error instanceof Error && error.message === 'PROJECT_PACKAGE_LIMIT' ? error : invalidPackage();
  } finally {
    for (const descriptor of openFiles) closeFile(descriptor);
  }
};

export const importProjectPackageArchive = async (
  workspace: ProjectLibraryHandle,
  input: ProjectPackageArchiveImportInput,
  limitOverrides: Partial<ProjectPackageImportLimits> = {},
): Promise<{ projectId: string }> => {
  const limits = { ...defaultLimits, ...limitOverrides };
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'designhub-package-import-'));
  try {
    const extracted = await extractArchive(input.archivePath, temporaryDirectory, limits);
    if (!extracted.names.has(projectPackageManifestPath)) throw invalidPackage();
    const manifestPath = resolveEntryPath(temporaryDirectory, projectPackageManifestPath);
    const manifestStatus = await lstat(manifestPath).catch(() => null);
    if (!manifestStatus?.isFile() || manifestStatus.isSymbolicLink() || manifestStatus.size > limits.maxManifestBytes) throw invalidPackage();
    const manifest = decodeProjectPackageManifest(new Uint8Array(await readFile(manifestPath)));
    if (manifest.entries.includes(projectPackageManifestPath)) throw invalidPackage();
    const payloadNames = [...extracted.names].filter((name) => name !== projectPackageManifestPath);
    if (payloadNames.length !== manifest.entries.length || manifest.entries.some((name) => !extracted.names.has(name))) throw invalidPackage();
    return await importExtractedProjectPackageToWorkspace(workspace, {
      libraryId: input.libraryId,
      operationId: input.operationId,
      packageId: manifest.packageId,
      sourceProjectId: manifest.projectId,
      readOnly: manifest.readOnly,
      entries: manifest.entries,
      directory: temporaryDirectory,
      contentHashes: extracted.contentHashes,
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

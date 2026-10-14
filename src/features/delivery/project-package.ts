import { isSafePackagePath } from './package-policy';
import { unzipSync } from 'fflate';

export type ProjectPackageManifest = { packageId: string; projectId: string; readOnly: boolean; entries: string[] };
export type ProjectPackage = {
  manifest: ProjectPackageManifest;
  files: Record<string, Uint8Array>;
};

const hasUniquePaths = (paths: readonly string[]): boolean => new Set(paths).size === paths.length;

export const projectPackageManifestPath = 'designhub.package.json';
const textDecoder = new TextDecoder();

const isPackageManifest = (value: unknown): value is ProjectPackageManifest => {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Record<string, unknown>;
  return typeof manifest.packageId === 'string'
    && manifest.packageId.trim().length > 0
    && typeof manifest.projectId === 'string'
    && manifest.projectId.trim().length > 0
    && typeof manifest.readOnly === 'boolean'
    && Array.isArray(manifest.entries)
    && manifest.entries.every((entry) => typeof entry === 'string' && isSafePackagePath(entry))
    && hasUniquePaths(manifest.entries as string[]);
};

export const decodeProjectPackageManifest = (bytes: Uint8Array): ProjectPackageManifest => {
  let value: unknown;
  try { value = JSON.parse(textDecoder.decode(bytes)) as unknown; } catch { throw new Error('INVALID_PACKAGE'); }
  if (!isPackageManifest(value)) throw new Error('INVALID_PACKAGE');
  return value;
};

export const decodeProjectPackage = async (archive: Uint8Array): Promise<ProjectPackage> => {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(archive); } catch { throw new Error('INVALID_PACKAGE'); }
  const manifestBytes = files[projectPackageManifestPath];
  if (!manifestBytes) throw new Error('INVALID_PACKAGE');
  const manifestValue = decodeProjectPackageManifest(manifestBytes);
  const declared = new Set(manifestValue.entries);
  const archivePaths = Object.keys(files).filter((path) => path !== projectPackageManifestPath);
  if (archivePaths.some((path) => !isSafePackagePath(path) || !declared.has(path)) || manifestValue.entries.some((path) => !files[path])) throw new Error('INVALID_PACKAGE');
  const payload: Record<string, Uint8Array> = {};
  manifestValue.entries.forEach((path) => { payload[path] = files[path]; });
  return { manifest: manifestValue, files: payload };
};

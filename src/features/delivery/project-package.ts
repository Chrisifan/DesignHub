import { isSafePackagePath } from './package-policy';
import { unzipSync } from 'fflate';

export type ProjectPackage = {
  manifest: { packageId: string; projectId: string; readOnly: boolean; entries: string[] };
  files: Record<string, Uint8Array>;
};

const hasUniquePaths = (paths: readonly string[]): boolean => new Set(paths).size === paths.length;

const packageManifestPath = 'designhub.package.json';
const textDecoder = new TextDecoder();

const isPackageManifest = (value: unknown): value is ProjectPackage['manifest'] => {
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

export const decodeProjectPackage = async (archive: Uint8Array): Promise<ProjectPackage> => {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(archive); } catch { throw new Error('INVALID_PACKAGE'); }
  const manifestBytes = files[packageManifestPath];
  if (!manifestBytes) throw new Error('INVALID_PACKAGE');
  let manifestValue: unknown;
  try { manifestValue = JSON.parse(textDecoder.decode(manifestBytes)) as unknown; } catch { throw new Error('INVALID_PACKAGE'); }
  if (!isPackageManifest(manifestValue)) throw new Error('INVALID_PACKAGE');
  const declared = new Set(manifestValue.entries);
  const archivePaths = Object.keys(files).filter((path) => path !== packageManifestPath);
  if (archivePaths.some((path) => !isSafePackagePath(path) || !declared.has(path)) || manifestValue.entries.some((path) => !files[path])) throw new Error('INVALID_PACKAGE');
  const payload: Record<string, Uint8Array> = {};
  manifestValue.entries.forEach((path) => { payload[path] = files[path]; });
  return { manifest: manifestValue, files: payload };
};

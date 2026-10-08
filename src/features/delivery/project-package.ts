import { createPackageClosureReport, isSafePackagePath, type PackageEntryKind } from './package-policy';
import { unzipSync, zipSync } from 'fflate';

export type ProjectPackageEntry = { path: string; bytes: Uint8Array; kind: PackageEntryKind };
export type ProjectPackage = {
  manifest: { packageId: string; projectId: string; readOnly: boolean; entries: string[] };
  files: Record<string, Uint8Array>;
};

export type CreateProjectPackageInput = {
  packageId: string;
  projectId: string;
  readOnly?: boolean;
  entries: ProjectPackageEntry[];
};

const hasUniquePaths = (paths: readonly string[]): boolean => new Set(paths).size === paths.length;

export const createProjectPackage = async (input: CreateProjectPackageInput): Promise<ProjectPackage> => {
  if (!input.packageId.trim() || !input.projectId.trim()) throw new Error('PACKAGE_BINDING_REQUIRED');
  if (!hasUniquePaths(input.entries.map((entry) => entry.path))) throw new Error('INVALID_PACKAGE');
  const closure = createPackageClosureReport(input.entries, Boolean(input.readOnly));
  const allowed = closure.included.map((entry) => entry.path);
  const allowedSet = new Set(allowed);
  if (!hasUniquePaths(allowed)) throw new Error('INVALID_PACKAGE');
  const files: Record<string, Uint8Array> = {};
  input.entries.forEach((entry) => {
    if (allowedSet.has(entry.path)) files[entry.path] = entry.bytes.slice();
  });
  return { manifest: { packageId: input.packageId, projectId: input.projectId, readOnly: Boolean(input.readOnly), entries: allowed }, files };
};

export const importProjectPackage = async (pack: ProjectPackage, options: { existingProjectIds: string[] }): Promise<{ projectId: string; entries: string[] }> => {
  if (!pack?.manifest?.packageId || !pack.manifest.projectId || options.existingProjectIds.includes(pack.manifest.projectId)) throw new Error('PROJECT_EXISTS');
  const entries = pack.manifest.entries.filter((path) => isSafePackagePath(path) && Object.prototype.hasOwnProperty.call(pack.files, path));
  if (entries.length !== pack.manifest.entries.length) throw new Error('INVALID_PACKAGE');
  return { projectId: `${pack.manifest.projectId}-${pack.manifest.packageId}`, entries };
};

const packageManifestPath = 'designhub.package.json';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const toBytes = (value: unknown): Uint8Array | null => {
  if (value instanceof Uint8Array) return value;
  if (!ArrayBuffer.isView(value)) return null;
  const view = value as Uint8Array;
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
};

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

export const encodeProjectPackage = async (pack: ProjectPackage): Promise<Uint8Array> => {
  if (!isPackageManifest(pack.manifest)) throw new Error('INVALID_PACKAGE');
  const files: Record<string, Uint8Array> = { [packageManifestPath]: textEncoder.encode(`${JSON.stringify(pack.manifest)}\n`) };
  pack.manifest.entries.forEach((path) => {
    const bytes = toBytes(pack.files[path]);
    if (!bytes || !isSafePackagePath(path)) throw new Error('INVALID_PACKAGE');
    // fflate consumes the bytes synchronously while building the archive. Do
    // not create another copy here; createProjectPackage already owns the
    // package input copy boundary.
    files[path] = bytes;
  });
  return zipSync(files, { level: 6 });
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

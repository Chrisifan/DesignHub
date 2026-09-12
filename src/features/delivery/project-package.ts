import { deliveryEntries, isSafePackagePath, type PackageEntryKind } from './package-policy';

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

export const createProjectPackage = async (input: CreateProjectPackageInput): Promise<ProjectPackage> => {
  if (!input.packageId.trim() || !input.projectId.trim()) throw new Error('PACKAGE_BINDING_REQUIRED');
  const allowed = input.readOnly ? deliveryEntries(input.entries) : input.entries
    .filter((entry) => entry.kind !== 'credential' && entry.kind !== 'font' && isSafePackagePath(entry.path))
    .map((entry) => entry.path);
  const files: Record<string, Uint8Array> = {};
  input.entries.forEach((entry) => {
    if (allowed.includes(entry.path)) files[entry.path] = entry.bytes.slice();
  });
  return { manifest: { packageId: input.packageId, projectId: input.projectId, readOnly: Boolean(input.readOnly), entries: allowed }, files };
};

export const importProjectPackage = async (pack: ProjectPackage, options: { existingProjectIds: string[] }): Promise<{ projectId: string; entries: string[] }> => {
  if (!pack?.manifest?.packageId || !pack.manifest.projectId || options.existingProjectIds.includes(pack.manifest.projectId)) throw new Error('PROJECT_EXISTS');
  const entries = pack.manifest.entries.filter((path) => isSafePackagePath(path) && Object.prototype.hasOwnProperty.call(pack.files, path));
  if (entries.length !== pack.manifest.entries.length) throw new Error('INVALID_PACKAGE');
  return { projectId: `${pack.manifest.projectId}-${pack.manifest.packageId}`, entries };
};

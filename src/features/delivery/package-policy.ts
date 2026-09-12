export type PackageEntryKind = 'output' | 'preview' | 'manifest' | 'conversation' | 'credential' | 'font';
export type PackageEntry = { path: string; kind: PackageEntryKind };

export const isSafePackagePath = (path: string): boolean => {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  return !path.split('/').some((part) => part === '..' || part === '.');
};

export const deliveryEntries = (entries: PackageEntry[]): string[] => entries
  .filter((entry) => ['output', 'preview', 'manifest'].includes(entry.kind) && isSafePackagePath(entry.path))
  .map((entry) => entry.path);

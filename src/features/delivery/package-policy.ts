export type PackageEntryKind = 'output' | 'preview' | 'manifest' | 'conversation' | 'credential' | 'font';
export type PackageEntry = { path: string; kind: PackageEntryKind };

export const classifyPackageEntry = (path: string): PackageEntryKind => {
  const normalized = path.toLowerCase();
  const segments = normalized.split('/');
  const basename = segments.at(-1) ?? '';
  if (segments.includes('exports') || segments.includes('output') || segments.includes('outputs')) return 'output';
  if (segments.includes('previews') || segments.includes('preview')) return 'preview';
  if (segments.some((segment) => segment.includes('conversation') || segment.includes('chat') || segment.includes('prompt'))) return 'conversation';
  if (segments.some((segment) => segment.includes('credential') || segment.includes('secret') || segment.includes('token')) || basename.endsWith('.key')) return 'credential';
  if (segments.includes('fonts') || /\.(ttf|otf|woff2?|eot)$/iu.test(basename)) return 'font';
  return 'manifest';
};

export const isSafePackagePath = (path: string): boolean => {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  return !path.split('/').some((part) => part === '..' || part === '.');
};

export const deliveryEntries = (entries: PackageEntry[]): string[] => entries
  .filter((entry) => ['output', 'preview', 'manifest'].includes(entry.kind) && isSafePackagePath(entry.path))
  .map((entry) => entry.path);

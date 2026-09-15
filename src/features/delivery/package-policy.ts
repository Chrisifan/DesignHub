export type PackageEntryKind = 'output' | 'preview' | 'manifest' | 'conversation' | 'credential' | 'font' | 'reference';
export type PackageEntry = { path: string; kind: PackageEntryKind };
export type PackageClosureReport = {
  included: PackageEntry[];
  excluded: Array<PackageEntry & { reason: 'private' | 'not-delivery' | 'unsafe-path' }>;
};

export const classifyPackageEntry = (path: string): PackageEntryKind => {
  const normalized = path.toLowerCase();
  const segments = normalized.split('/');
  const basename = segments.at(-1) ?? '';
  if (segments.includes('exports') || segments.includes('output') || segments.includes('outputs')) return 'output';
  if (segments.includes('previews') || segments.includes('preview')) return 'preview';
  if (segments.includes('references') || segments.includes('reference')) return 'reference';
  if (segments.some((segment) => segment.includes('conversation') || segment.includes('chat') || segment.includes('prompt'))) return 'conversation';
  if (segments.some((segment) => segment.includes('credential') || segment.includes('secret') || segment.includes('token')) || basename.endsWith('.key')) return 'credential';
  if (segments.includes('fonts') || /\.(ttf|otf|woff2?|eot)$/iu.test(basename)) return 'font';
  return 'manifest';
};

export const isSafePackagePath = (path: string): boolean => {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || /^[A-Za-z]:/u.test(path)) return false;
  const segments = path.split('/');
  return segments.every((part) => part.length > 0 && part !== '..' && part !== '.' && !/[\u0000-\u001f]/u.test(part));
};

export const deliveryEntries = (entries: PackageEntry[]): string[] => entries
  .filter((entry) => ['output', 'preview', 'manifest'].includes(entry.kind) && isSafePackagePath(entry.path))
  .map((entry) => entry.path);

export const createPackageClosureReport = (entries: PackageEntry[], readOnly = false): PackageClosureReport => {
  const included: PackageEntry[] = [];
  const excluded: Array<PackageEntry & { reason: PackageClosureReport['excluded'][number]['reason'] }> = [];
  entries.forEach((entry) => {
    if (!isSafePackagePath(entry.path)) {
      excluded.push({ ...entry, reason: 'unsafe-path' });
      return;
    }
    if (entry.kind === 'credential' || entry.kind === 'font') {
      excluded.push({ ...entry, reason: 'private' });
      return;
    }
    if (entry.kind === 'reference' || (readOnly && !['output', 'preview', 'manifest'].includes(entry.kind))) {
      excluded.push({ ...entry, reason: 'not-delivery' });
      return;
    }
    included.push({ ...entry });
  });
  return { included, excluded };
};

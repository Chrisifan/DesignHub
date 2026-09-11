export type WorkspaceOpenMode = 'writable' | 'read-only' | 'migration-required';

export const getOpenMode = (format: number, supported: number, locked: boolean): WorkspaceOpenMode => {
  if (locked || format > supported) return 'read-only';
  return format < supported ? 'migration-required' : 'writable';
};

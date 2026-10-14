export const isSafePackagePath = (path: string): boolean => {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || /^[A-Za-z]:/u.test(path)) return false;
  const segments = path.split('/');
  return segments.every((part) => part.length > 0 && part !== '..' && part !== '.' && !/[\u0000-\u001f]/u.test(part));
};

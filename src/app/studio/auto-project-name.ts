import type { Locale } from '../i18n';

export const createAutomaticProjectName = (
  locale: Locale,
  existingNames: readonly string[],
): string => {
  const base = locale === 'zh-CN' ? '未命名项目' : 'Untitled project';
  const names = new Set(existingNames.map((name) => name.trim()));
  if (!names.has(base)) return base;

  for (let suffix = 1; ; suffix += 1) {
    const candidate = `${base} (${suffix})`;
    if (!names.has(candidate)) return candidate;
  }
};

import { expect, it } from 'vitest';

import { createAutomaticProjectName } from './auto-project-name';

it('uses the current locale for the base automatic project name', () => {
  expect(createAutomaticProjectName('zh-CN', [])).toBe('未命名项目');
  expect(createAutomaticProjectName('en', [])).toBe('Untitled project');
});

it('uses the first available numeric suffix without renaming existing projects', () => {
  expect(createAutomaticProjectName('zh-CN', [
    '未命名项目',
    '未命名项目 (2)',
    '其他项目',
  ])).toBe('未命名项目 (1)');
  expect(createAutomaticProjectName('en', [
    'Untitled project',
    'Untitled project (1)',
  ])).toBe('Untitled project (2)');
});

import { expect, it } from 'vitest';

import { matchesDesigner, matchesSearch } from './filter';

it('按历史贡献者检索，不限当前活跃设计师', () => {
  expect(matchesDesigner({ contributorIds: ['designer-a', 'designer-b'] }, 'designer-a')).toBe(true);
  expect(matchesDesigner({ contributorIds: ['designer-b'] }, 'designer-a')).toBe(false);
});

it('supports Chinese and English substring matching across indexed text', () => {
  const item = { title: '春间市集', brief: 'Spring Market campaign', tags: ['春间', 'market'] };
  expect(matchesSearch(item, '春间')).toBe(true);
  expect(matchesSearch(item, '市集')).toBe(true);
  expect(matchesSearch(item, 'Spring Market')).toBe(true);
  expect(matchesSearch(item, 'winter')).toBe(false);
});

import { expect, it } from 'vitest';

import { cloneDesignerState, isDesignerLibraryState, type DesignerLibraryState } from './persistence';

const state: DesignerLibraryState = {
  profiles: [],
  defaultId: 'builtin-v1',
  drafts: {
    newDraft: { name: '未完成档案', summary: '保留草稿' },
  },
};

it('clones a designer state including drafts without sharing mutable references', () => {
  const copy = cloneDesignerState(state);
  state.drafts!.newDraft!.name = '修改原稿';
  expect(copy).toEqual({
    profiles: [],
    defaultId: 'builtin-v1',
    drafts: { newDraft: { name: '未完成档案', summary: '保留草稿' } },
  });
});

it('rejects persisted designer state with an invalid default id', () => {
  expect(isDesignerLibraryState({ profiles: [], defaultId: '' })).toBe(false);
});

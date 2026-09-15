import { expect, it } from 'vitest';

import { cloneDesignerState, isDesignerLibraryState, normalizeDesignerState, type DesignerLibraryState } from './persistence';
import type { PersonaProfile } from '../../app/studio/personas';

const state: DesignerLibraryState = {
  profiles: [],
  defaultId: '',
  drafts: {
    newDraft: { name: '未完成档案', summary: '保留草稿' },
  },
};

it('clones a designer state including drafts without sharing mutable references', () => {
  const copy = cloneDesignerState(state);
  state.drafts!.newDraft!.name = '修改原稿';
  expect(copy).toEqual({
    profiles: [],
    defaultId: '',
    drafts: { newDraft: { name: '未完成档案', summary: '保留草稿' } },
  });
});

it('allows an empty designer library without a default profile', () => {
  expect(isDesignerLibraryState({ profiles: [], defaultId: '' })).toBe(true);
});

it('rejects malformed portfolio sheet records before they reach the UI', () => {
  expect(isDesignerLibraryState({
    profiles: [{
      id: 'custom', name: { zh: '自定义', en: 'Custom' }, signature: { zh: '', en: '' }, summary: { zh: '', en: '' }, principle: { zh: '', en: '' }, personaCode: 'CUSTOM', version: 'v1', status: 'draft', artworkUrl: '', artworkAlt: { zh: '', en: '' }, tags: [], referenceCount: 0, styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } }, negativeRules: [], portfolioSheets: [null],
    }],
    defaultId: 'custom',
  })).toBe(false);
});

it('persists an optional custom artwork asset reference alongside its URL', () => {
  const profile = {
    id: 'custom-art', name: { zh: '自定义', en: 'Custom' }, signature: { zh: '', en: '' }, summary: { zh: '', en: '' }, principle: { zh: '', en: '' }, personaCode: 'CUSTOM', version: 'v1', status: 'draft', artworkAssetId: 'asset-portrait', artworkUrl: 'asset://asset-portrait', artworkAlt: { zh: '形象', en: 'Portrait' }, tags: [], referenceCount: 0, styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } }, negativeRules: [], portfolioSheets: [],
  };
  expect(isDesignerLibraryState({ profiles: [profile], defaultId: 'custom-art' })).toBe(true);
});

it('removes legacy seeded designer profiles without touching real user profiles', () => {
  const legacy = {
    id: 'paper-type', name: { zh: '纸感排版', en: 'Paper & Type' }, signature: { zh: '示例', en: 'Example' },
    summary: { zh: '', en: '' }, principle: { zh: '', en: '' }, personaCode: 'INTP-A', version: 'v1.4',
    status: 'published', artworkUrl: '/personas/paper-type.png', artworkAlt: { zh: '', en: '' }, tags: [], referenceCount: 5,
    styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } }, negativeRules: [], portfolioSheets: [],
  } as const;
  const user = { ...legacy, id: 'custom-1', name: { zh: '我的设计师', en: 'My designer' }, status: 'draft', referenceCount: 0 } as const;
  const normalized = normalizeDesignerState({ profiles: [legacy as unknown as PersonaProfile, user as unknown as PersonaProfile], defaultId: 'paper-type' });
  expect(normalized.profiles.map((profile) => profile.id)).toEqual(['custom-1']);
  expect(normalized.defaultId).toBe('');
  expect(normalized.profiles[0]?.name.zh).toBe('我的设计师');
});

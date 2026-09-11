import { expect, it } from 'vitest';

import { BriefDraft, confirmBrief } from './brief';

it('returns a confirmed brief with the same workspace', () => {
  const draft = { name: 'Spring Market', workspaceId: 'workspace-1' };

  expect(confirmBrief(draft, true)).toEqual(draft);
});

it('requires explicit confirmation before accepting a brief', () => {
  const draft = { name: 'Spring Market', workspaceId: 'workspace-1' };

  expect(() => confirmBrief(draft, false)).toThrow('CONFIRM_REQUIRED');
});

it('trims the confirmed brief name', () => {
  const draft = { name: '  Spring Market  ', workspaceId: 'workspace-1' };

  expect(confirmBrief(draft, true)).toEqual({ name: 'Spring Market', workspaceId: 'workspace-1' });
});

it('does not mutate the draft while confirming it', () => {
  const draft = { name: '  Spring Market  ', workspaceId: 'workspace-1' };

  confirmBrief(draft, true);

  expect(draft).toEqual({ name: '  Spring Market  ', workspaceId: 'workspace-1' });
});

it('rejects a blank name or missing workspace', () => {
  expect(() => confirmBrief({ name: '  ', workspaceId: 'workspace-1' }, true)).toThrow('INVALID_BRIEF');
  expect(() => confirmBrief({ name: 'Spring Market', workspaceId: '' }, true)).toThrow('INVALID_BRIEF');
});

it('rejects a malformed draft with an undefined workspace', () => {
  const draft = { name: 'Spring Market', workspaceId: undefined } as unknown as BriefDraft;

  expect(() => confirmBrief(draft, true)).toThrow('INVALID_BRIEF');
});

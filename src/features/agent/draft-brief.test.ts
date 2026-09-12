import { expect, it } from 'vitest';
import { draftBrief } from './draft-brief';

it('creates a brief draft task without creating a project', async () => {
  await expect(draftBrief({ text: 'Spring market poster', creationDraftId: 'creation-1', connectionId: 'provider-1' })).resolves.toEqual({
    taskId: expect.any(String),
    creationDraftId: 'creation-1',
  });
});

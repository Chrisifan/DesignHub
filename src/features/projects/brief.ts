export type BriefDraft = {
  name: string;
  workspaceId: string;
};

export const confirmBrief = (draft: BriefDraft, confirmed: boolean): BriefDraft => {
  if (!confirmed) throw new Error('CONFIRM_REQUIRED');
  if (typeof draft.name !== 'string' || typeof draft.workspaceId !== 'string') throw new Error('INVALID_BRIEF');

  const name = draft.name.trim();
  if (!name || !draft.workspaceId.trim()) throw new Error('INVALID_BRIEF');

  return { ...draft, name };
};

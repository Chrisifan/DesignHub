export type DraftBriefInput = {
  text: string;
  creationDraftId: string;
  connectionId: string;
};

const createTaskId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

export const draftBrief = async (input: DraftBriefInput): Promise<{ taskId: string; creationDraftId: string }> => {
  if (!input.text.trim()) throw new Error('BRIEF_TEXT_REQUIRED');
  if (!input.creationDraftId.trim() || !input.connectionId.trim()) throw new Error('BRIEF_BINDING_REQUIRED');
  return { taskId: createTaskId('brief-draft'), creationDraftId: input.creationDraftId };
};

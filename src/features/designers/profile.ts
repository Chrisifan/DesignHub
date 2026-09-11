export type DesignerDraft = {
  name: string;
  rules: string[];
};

export type DesignerVersion = {
  versionId: string;
  name: string;
  rules: string[];
};

export const publishDesigner = (draft: DesignerDraft, versionId: string): DesignerVersion => {
  const name = draft.name.trim();
  if (!name) throw new Error('NAME_REQUIRED');
  return { versionId, name, rules: [...draft.rules] };
};

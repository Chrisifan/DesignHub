export type DesignerDefaultInput = {
  project?: string;
  workspace?: string;
  global?: string;
  available: string[];
  builtin: string;
};

export const resolveDesigner = (input: DesignerDefaultInput): string => [
  input.project,
  input.workspace,
  input.global,
].find((id): id is string => Boolean(id && input.available.includes(id))) ?? input.builtin;

export type DesignerHandoffState = { activeDesignerVersionId: string };

export const switchDesigner = (state: DesignerHandoffState, next: string): DesignerHandoffState => {
  if (!next.trim()) throw new Error('DESIGNER_REQUIRED');
  return { ...state, activeDesignerVersionId: next };
};

export const createHandoffSummary = (input: {
  target: string;
  fixedCopy?: string;
  direction?: string;
  pending?: string[];
}) => ({
  target: input.target.trim(),
  fixedCopy: input.fixedCopy?.trim() ?? '',
  direction: input.direction?.trim() ?? '',
  pending: [...(input.pending ?? [])],
});

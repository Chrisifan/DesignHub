export type DesignerArchiveState = {
  status: 'built-in' | 'published' | 'archived';
  referenceCount: number;
};

export const canArchiveDesigner = (designer: DesignerArchiveState): boolean => designer.status !== 'built-in';

export const archiveDesigner = (designer: DesignerArchiveState): DesignerArchiveState => {
  if (!canArchiveDesigner(designer)) throw new Error('BUILTIN_CANNOT_ARCHIVE');
  return { ...designer, status: 'archived' };
};

export const restoreDesigner = (designer: DesignerArchiveState): DesignerArchiveState => {
  if (designer.status === 'built-in') return { ...designer };
  return { ...designer, status: 'published' };
};

export const canPermanentlyRemoveDesigner = (designer: DesignerArchiveState): boolean => (
  designer.status === 'archived' && designer.referenceCount === 0
);

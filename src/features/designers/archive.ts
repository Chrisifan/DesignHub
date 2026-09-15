export type DesignerArchiveState = {
  /** `built-in` is accepted only for legacy workspace data and is normalized on load. */
  status: 'built-in' | 'published' | 'archived';
  referenceCount: number;
};

export const canArchiveDesigner = (designer: DesignerArchiveState): boolean => (
  designer.status === 'built-in' || designer.status === 'published' || designer.status === 'archived'
);

export const archiveDesigner = (designer: DesignerArchiveState): DesignerArchiveState => {
  return { ...designer, status: 'archived' };
};

export const restoreDesigner = (designer: DesignerArchiveState): DesignerArchiveState => {
  return { ...designer, status: 'published' };
};

export const canPermanentlyRemoveDesigner = (designer: DesignerArchiveState): boolean => (
  designer.status === 'archived' && designer.referenceCount === 0
);

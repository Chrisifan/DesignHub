export type ProjectLibraryOpenMode = 'writable' | 'read-only' | 'migration-required';

export type ProjectLibraryDescriptor = {
  libraryId: string;
  directory: string;
  formatVersion: number;
  openMode: ProjectLibraryOpenMode;
};

export type ProjectLibraryHandle = {
  library: ProjectLibraryDescriptor;
  close: () => void;
};

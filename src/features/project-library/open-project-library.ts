export type ProjectLibraryOpenMode = 'writable' | 'read-only' | 'migration-required';

export type ProjectLibraryDescriptor = {
  libraryId: string;
  /** Display name is optional for persisted descriptors and native fixtures. */
  name?: string;
  directory: string;
  formatVersion: number;
  openMode: ProjectLibraryOpenMode;
};

export type ProjectLibraryHandle = {
  library: ProjectLibraryDescriptor;
  close: () => void;
};

export type ProjectLibraryStatus =
  | { state: 'unselected' }
  | { state: 'ready'; library: ProjectLibraryDescriptor }
  | { state: 'needs-location'; directory: string; reason: 'missing' | 'unavailable' | 'invalid' };

export const defaultProjectCoverUrl = '/project-default-cover.png';
export const maxProjectCoverBytes = 20 * 1024 * 1024;
export const supportedProjectCoverMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type ProjectCoverFile = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type ProjectCoverValidationError = 'EMPTY_FILE' | 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE';

export const validateProjectCoverFile = (file: File): ProjectCoverValidationError | null => {
  if (file.size === 0) return 'EMPTY_FILE';
  if (!supportedProjectCoverMimeTypes.includes(file.type as typeof supportedProjectCoverMimeTypes[number])) return 'UNSUPPORTED_TYPE';
  if (file.size > maxProjectCoverBytes) return 'FILE_TOO_LARGE';
  return null;
};

const readFileBytes = async (file: File): Promise<ArrayBuffer> => {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('PROJECT_COVER_READ_FAILED'));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('PROJECT_COVER_READ_FAILED'));
    };
    reader.readAsArrayBuffer(file);
  });
};

export const readProjectCoverFile = async (file: File): Promise<ProjectCoverFile> => ({
  name: file.name,
  mimeType: file.type,
  bytes: new Uint8Array(await readFileBytes(file)),
});

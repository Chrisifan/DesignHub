export type ReadImage = { name: string; mimeType: string; bytes: Uint8Array; previewUrl: string; file: File };

const toDataUrl = (mimeType: string, bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const readBytes = (file: File): Promise<ArrayBuffer> => typeof file.arrayBuffer === 'function'
  ? file.arrayBuffer()
  : new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('IMAGE_READ_FAILED'));
    reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });

export const readImageFile = async (file: File): Promise<ReadImage> => {
  const mimeType = file.type || 'image/png';
  const bytes = new Uint8Array(await readBytes(file));
  return { file, name: file.name || `image-${Date.now()}.png`, mimeType, bytes, previewUrl: toDataUrl(mimeType, bytes) };
};

export const imageFilesFromTransfer = (transfer: DataTransfer): File[] => Array.from(transfer.files).filter((file) => file.type.startsWith('image/'));

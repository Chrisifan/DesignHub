export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'pdf';

export const needsBackground = (format: ExportFormat, hasTransparency: boolean): boolean => format === 'jpeg' && hasTransparency;

export const outputMime = (format: ExportFormat): string => ({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' })[format];

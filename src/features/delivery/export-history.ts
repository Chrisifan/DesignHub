import type { ExportFormat } from './export-policy';

export type ExportHistoryRecord = {
  id: string;
  projectId: string;
  documentId: string;
  revisionId: string;
  format: ExportFormat;
  targetPath: string;
  sha256?: string;
  status: 'success' | 'failed';
  archived: boolean;
  errorCode?: string;
  createdAt: string;
};

const isFormat = (value: unknown): value is ExportFormat => value === 'png' || value === 'jpeg' || value === 'webp' || value === 'pdf';
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const isExportHistoryRecord = (value: unknown): value is ExportHistoryRecord => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.projectId === 'string' && value.projectId.trim().length > 0
    && typeof value.documentId === 'string' && value.documentId.trim().length > 0
    && typeof value.revisionId === 'string' && value.revisionId.trim().length > 0
    && isFormat(value.format)
    && typeof value.targetPath === 'string' && value.targetPath.trim().length > 0
    && (value.sha256 === undefined || (typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(value.sha256)))
    && (value.status === 'success' || value.status === 'failed')
    && typeof value.archived === 'boolean'
    && (value.errorCode === undefined || (typeof value.errorCode === 'string' && value.errorCode.trim().length > 0))
    && typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt));
};

export const appendExportHistory = (previous: readonly ExportHistoryRecord[], record: ExportHistoryRecord): ExportHistoryRecord[] => {
  if (!isExportHistoryRecord(record)) throw new Error('INVALID_EXPORT_HISTORY');
  if (!previous.every(isExportHistoryRecord)) throw new Error('INVALID_EXPORT_HISTORY');
  return [structuredClone(record), ...previous.map((entry) => structuredClone(entry))].slice(0, 200);
};

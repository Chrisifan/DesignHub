import { useState, type DragEvent, type ClipboardEvent } from 'react';

import type { PortfolioInspectionRequest } from '../../platform/contracts';
import type { Locale } from '../i18n';
import { Icon, t } from './ui';

const maxPortfolioSources = 8;
const maxImageBytes = 8 * 1024 * 1024;
const maxArchiveBytes = 24 * 1024 * 1024;
const supportedImageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

type UploadError = { zh: string; en: string };

const extensionForName = (name: string): string => name.split('.').at(-1)?.toLowerCase() ?? '';

export const validatePortfolioUpload = (files: readonly File[]): UploadError | null => {
  if (files.length === 0) return { zh: '请至少选择一个文件。', en: 'Choose at least one file.' };
  const extensions = files.map(({ name }) => extensionForName(name));
  if (extensions.some((extension) => extension !== 'zip' && !supportedImageExtensions.has(extension))) {
    return { zh: '请使用 PNG、JPEG、WebP、GIF 或 ZIP 文件。', en: 'Use PNG, JPEG, WebP, GIF, or ZIP files.' };
  }
  const zipCount = extensions.filter((extension) => extension === 'zip').length;
  if (zipCount > 1) return { zh: '只能上传一个 ZIP 压缩包。', en: 'Upload only one ZIP archive.' };
  if (zipCount === 1 && files.length !== 1) return { zh: '请选择图片或一个 ZIP，不要混合上传。', en: 'Upload images or one ZIP, not both.' };
  if (zipCount === 0 && files.length > maxPortfolioSources) return { zh: '最多上传 8 张图片。', en: 'Upload at most 8 images.' };
  if (zipCount === 1 && files[0]!.size > maxArchiveBytes) return { zh: 'ZIP 压缩包不能超过 24 MiB。', en: 'The ZIP archive must be 24 MiB or smaller.' };
  if (zipCount === 0 && files.some(({ size }) => size > maxImageBytes)) return { zh: '每张图片不能超过 8 MiB。', en: 'Each image must be 8 MiB or smaller.' };
  return null;
};

type PortfolioUploaderProps = {
  locale: Locale;
  busy: boolean;
  onInspect: (request: PortfolioInspectionRequest) => void | Promise<void>;
  onError: (message: string) => void;
};

export const PortfolioUploader = ({ locale, busy, onInspect, onError }: PortfolioUploaderProps) => {
  const [dragging, setDragging] = useState(false);
  const inspectFiles = async (files: readonly File[]): Promise<void> => {
    try {
      const error = validatePortfolioUpload(files);
      if (error) {
        onError(t(locale, error.zh, error.en));
        return;
      }
      await onInspect({
        kind: 'uploaded-files',
        files: await Promise.all(files.map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        }))),
      });
    } catch {
      onError(t(locale, '无法读取所选文件。', 'The selected files could not be read.'));
    }
  };
  const dropFiles = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    setDragging(false);
    void inspectFiles(Array.from(event.dataTransfer.files));
  };
  const pasteFiles = (event: ClipboardEvent<HTMLButtonElement>): void => {
    if (event.clipboardData.files.length === 0) return;
    event.preventDefault();
    void inspectFiles(Array.from(event.clipboardData.files));
  };

  return <button
    type="button"
    className={`portfolio-uploader${dragging ? ' is-dragging' : ''}`}
    aria-label={t(locale, '上传作品集文件', 'Upload portfolio files')}
    disabled={busy}
    onClick={() => { void onInspect({ kind: 'local-files' }); }}
    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onDrop={dropFiles}
    onPaste={pasteFiles}
  >
    <Icon name="upload" size={20} />
    <strong>{t(locale, '点击、拖入或粘贴文件', 'Click, drop, or paste files')}</strong>
    <small>{t(locale, '最多 8 张图片，或 1 个 ZIP', 'Up to 8 images, or 1 ZIP')}</small>
  </button>;
};

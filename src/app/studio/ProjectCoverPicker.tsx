import { useRef, useState, type ChangeEvent } from 'react';

import type { Locale } from '../i18n';
import { defaultProjectCoverUrl, readProjectCoverFile, validateProjectCoverFile, type ProjectCoverValidationError } from './project-cover';
import type { ProjectCoverDraft } from './types';
import { Button, Icon, t } from './ui';

type ProjectCoverPickerProps = {
  locale: Locale;
  value?: ProjectCoverDraft;
  onChange: (value: ProjectCoverDraft | undefined) => void;
};

const validationMessage = (locale: Locale, error: ProjectCoverValidationError | 'READ_FAILED'): string => {
  if (error === 'FILE_TOO_LARGE') return t(locale, '封面图片不能超过 20 MB。', 'Cover images must be 20 MB or smaller.');
  if (error === 'EMPTY_FILE') return t(locale, '封面图片不能为空。', 'The cover image cannot be empty.');
  if (error === 'READ_FAILED') return t(locale, '无法读取这张图片，请重新选择。', 'Could not read this image. Choose another file.');
  return t(locale, '请选择 PNG、JPEG 或 WebP 图片。', 'Choose a PNG, JPEG, or WebP image.');
};

export const ProjectCoverPicker = ({ locale, value, onChange }: ProjectCoverPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validationError = validateProjectCoverFile(file);
    if (validationError) {
      setError(validationMessage(locale, validationError));
      return;
    }
    try {
      const cover = await readProjectCoverFile(file);
      const previewUrl = URL.createObjectURL(file);
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
      setError('');
      onChange({ ...cover, previewUrl });
    } catch {
      setError(validationMessage(locale, 'READ_FAILED'));
    }
  };

  const restoreDefault = (): void => {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    setError('');
    onChange(undefined);
  };

  return (
    <section className="project-cover-picker" aria-labelledby="project-cover-picker-title">
      <div className="project-cover-picker__heading">
        <div>
          <span id="project-cover-picker-title">{t(locale, '项目封面', 'Project cover')}</span>
          <small>{t(locale, 'PNG、JPEG 或 WebP，最大 20 MB', 'PNG, JPEG, or WebP, up to 20 MB')}</small>
        </div>
        {value ? <button type="button" className="project-cover-picker__reset" aria-label={t(locale, '恢复默认封面', 'Restore default cover')} onClick={restoreDefault}>{t(locale, '恢复默认', 'Use default')}</button> : null}
      </div>
      <div className="project-cover-picker__preview">
        <img src={value?.previewUrl ?? defaultProjectCoverUrl} alt={t(locale, '项目封面', 'Project cover')} />
        <div className="project-cover-picker__overlay">
          <Button variant="secondary" icon={value ? 'refresh-cw' : 'upload'} onClick={() => inputRef.current?.click()}>
            {value ? t(locale, '更换封面', 'Replace cover') : t(locale, '选择图片', 'Choose image')}
          </Button>
          <span><Icon name="image" size={14} />{value?.name ?? t(locale, '默认封面', 'Default cover')}</span>
        </div>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={t(locale, '选择项目封面', 'Choose project cover')}
        onChange={(event) => { void handleFileChange(event); }}
      />
      {error ? <p className="project-cover-picker__error" role="alert">{error}</p> : null}
    </section>
  );
};

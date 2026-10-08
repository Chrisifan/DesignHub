import { useRef, useState, type ClipboardEvent, type FormEvent, type RefObject } from 'react';

import type { ConversationImageAttachment } from '../../features/agent/task-service';
import { isProjectGenerationRatio, projectGenerationRatios, type ProjectGenerationRatio } from '../../features/projects/size';
import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import { localize, type PersonaProfile } from './personas';
import { Icon, IconButton, Modal, Select, t } from './ui';
import './conversation-dock.css';

export type ConversationDockVariant = 'compact' | 'expanded';

export type ConversationDockAttachment = ConversationImageAttachment & {
  previewUrl: string;
  /** Existing project assets are referenced by ID instead of re-uploaded. */
  assetId?: string;
};

type ConversationDockProps = {
  variant: ConversationDockVariant;
  locale: Locale;
  value: string;
  attachments: ConversationDockAttachment[];
  readOnly: boolean;
  busy?: boolean;
  conversationConnected: boolean;
  designer: PersonaProfile | null;
  designerOptions?: PersonaProfile[];
  textareaLabel: string;
  placeholder: string;
  submitLabel: string;
  busyLabel?: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  generationRatio?: ProjectGenerationRatio;
  onGenerationRatioChange?: (ratio: ProjectGenerationRatio) => void;
  /** Kept for callers that still track managed references; references are intentionally quiet in the dock. */
  referencedAssetCount?: number;
  showGenerate?: boolean;
  generateDisabled?: boolean;
  onValueChange: (value: string) => void;
  onAttachmentsChange: (attachments: ConversationDockAttachment[]) => void;
  onSubmit: () => void;
  onDesignerChange?: (designerId: string) => void;
  onOpenTasks?: () => void;
  onOpenHistory?: () => void;
  onGenerate?: () => void;
  notify: (message: string) => void;
};

const maxAttachmentCount = 8;
const maxAttachmentBytes = 8 * 1024 * 1024;

const bytesToDataUrl = (mimeType: string, bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const readFileBytes = (file: File): Promise<ArrayBuffer> => {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(reader.result)
      : reject(new Error('IMAGE_READ_FAILED'));
    reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });
};

const readImageFile = async (file: File): Promise<ConversationDockAttachment> => {
  const mimeType = file.type || 'image/png';
  const bytes = new Uint8Array(await readFileBytes(file));
  return {
    name: file.name || `image-${Date.now()}.png`,
    mimeType,
    bytes,
    previewUrl: bytesToDataUrl(mimeType, bytes),
  };
};

export const ConversationDock = ({
  variant,
  locale,
  value,
  attachments,
  readOnly,
  busy = false,
  conversationConnected,
  designer,
  designerOptions = [],
  textareaLabel,
  placeholder,
  submitLabel,
  busyLabel,
  textareaRef,
  generationRatio = '3:4',
  onGenerationRatioChange,
  showGenerate = false,
  generateDisabled = false,
  onValueChange,
  onAttachmentsChange,
  onSubmit,
  onDesignerChange,
  onOpenTasks,
  onOpenHistory,
  onGenerate,
  notify,
}: ConversationDockProps) => {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<ConversationDockAttachment | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const compact = variant === 'compact';

  const addFiles = async (files: readonly File[]): Promise<void> => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      notify(t(locale, '只能添加图片文件。', 'Only image files can be attached.'));
    }
    const accepted = imageFiles
      .slice(0, Math.max(0, maxAttachmentCount - attachments.length))
      .filter((file) => {
        if (file.size <= maxAttachmentBytes) return true;
        notify(t(locale, '图片不能超过 8 MiB。', 'Images must be 8 MiB or smaller.'));
        return false;
      });
    if (!accepted.length) return;
    try {
      const next = await Promise.all(accepted.map(readImageFile));
      onAttachmentsChange([...attachments, ...next]);
    } catch {
      notify(t(locale, '无法读取图片。', 'The image could not be read.'));
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy || readOnly || (!compact && !value.trim())) return;
    onSubmit();
  };
  const paste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = Array.from(event.clipboardData.files);
    if (!files.length) return;
    event.preventDefault();
    void addFiles(files);
  };
  const availableDesigners = [
    ...(designer && !designerOptions.some((profile) => profile.id === designer.id) ? [designer] : []),
    ...designerOptions.filter((profile) => profile.status !== 'archived'),
  ];
  const renderDesignerAvatar = (profile?: PersonaProfile) => profile
    ? <PersonaArtwork locale={locale} personaId={profile.id} profile={profile} crop="avatar" />
    : <span className="conversation-dock__designer-placeholder"><Icon name="users" size={14} /></span>;
  const designerSelectOptions = [
    {
      value: '',
      label: <span className="conversation-dock__designer-option">{renderDesignerAvatar()}<span>{t(locale, '未设置设计师', 'No designer selected')}</span></span>,
    },
    ...availableDesigners.map((profile) => ({
      value: profile.id,
      label: <span className="conversation-dock__designer-option">{renderDesignerAvatar(profile)}<span>{localize(locale, profile.name)}</span></span>,
    })),
  ];

  return (
    <>
      <form
        className={`conversation-dock conversation-dock--${variant}${inputFocused ? ' conversation-dock--input-focused' : ''}`}
        aria-label={t(locale, 'AI 操作坞', 'AI command dock')}
        aria-busy={busy}
        onSubmit={submit}
      >
        {attachments.length > 0 && (
          <div className="conversation-dock__attachments" aria-label={t(locale, '已添加图片', 'Attached images')}>
            {attachments.map((attachment, index) => (
              <div className="conversation-dock__attachment" key={`${attachment.previewUrl}-${index}`}>
                <button
                  type="button"
                  className="conversation-dock__attachment-preview"
                  aria-label={t(locale, `预览 ${attachment.name}`, `Preview ${attachment.name}`)}
                  onClick={() => setPreviewAttachment(attachment)}
                >
                  <img src={attachment.previewUrl} alt="" />
                  <span>{attachment.name}</span>
                </button>
                <IconButton
                  name="x"
                  label={t(locale, `删除 ${attachment.name}`, `Remove ${attachment.name}`)}
                  onClick={() => {
                    onAttachmentsChange(attachments.filter((entry) => entry !== attachment));
                    if (previewAttachment === attachment) setPreviewAttachment(null);
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="conversation-dock__input-wrap">
          <textarea
            ref={textareaRef}
            rows={compact ? 2 : 4}
            value={value}
            disabled={readOnly}
            aria-label={textareaLabel}
            placeholder={placeholder}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onChange={(event) => onValueChange(event.target.value)}
            onPaste={paste}
          />
        </div>
        <div className="conversation-dock__toolbar">
          <div className="conversation-dock__toolbar-leading">
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={readOnly}
              aria-label={t(locale, '选择图片文件', 'Choose image files')}
              onChange={(event) => {
                void addFiles(Array.from(event.currentTarget.files ?? []));
                event.currentTarget.value = '';
              }}
            />
            <IconButton
              name="plus"
              label={t(locale, '添加图片', 'Add image')}
              disabled={readOnly}
              onClick={() => attachmentInputRef.current?.click()}
            />
            <div className="conversation-dock__status" aria-live="polite">
              <span className={conversationConnected ? 'is-connected' : ''} aria-hidden="true" />
              {busy && busyLabel
                ? busyLabel
                : conversationConnected
                ? t(locale, '对话模型已连接', 'Conversation model connected')
                : t(locale, '对话模型未连接', 'Conversation model disconnected')}
            </div>
          </div>
          <div className="conversation-dock__toolbar-actions">
            <Select
              className="conversation-dock__ratio-select"
              ariaLabel={t(locale, '设计稿比例', 'Design ratio')}
              value={generationRatio}
              options={projectGenerationRatios.map((ratio) => ({ value: ratio, label: ratio.replace(':', ' : ') }))}
              disabled={readOnly}
              onChange={(value) => {
                if (isProjectGenerationRatio(value)) onGenerationRatioChange?.(value);
              }}
            />
            <Select
              className="conversation-dock__designer-select"
              ariaLabel={t(locale, '设计师', 'Designer')}
              value={designer?.id ?? ''}
              options={designerSelectOptions}
              disabled={readOnly || !onDesignerChange}
              onChange={(value) => onDesignerChange?.(value)}
              renderValue={(option) => renderDesignerAvatar(availableDesigners.find((profile) => profile.id === option?.value))}
            />
            {compact && onOpenTasks && <IconButton name="list" label={t(locale, '模型任务', 'Model tasks')} onClick={onOpenTasks} />}
            {compact && onOpenHistory && <IconButton name="history" label={t(locale, '版本历史', 'Version history')} onClick={onOpenHistory} />}
            {compact && showGenerate && onGenerate && (
              <IconButton name="sparkles" label={t(locale, '生成', 'Generate')} disabled={generateDisabled} onClick={onGenerate} />
            )}
            {compact ? (
              <IconButton className="conversation-dock__send-control" name="arrow-up" label={submitLabel} disabled={busy || readOnly} onClick={onSubmit} />
            ) : (
              <button className="conversation-dock__submit conversation-dock__send-control" type="submit" disabled={busy || readOnly || !value.trim()} aria-label={submitLabel}>
                <Icon name={busy ? 'clock' : 'arrow-up'} size={19} />
              </button>
            )}
          </div>
        </div>
      </form>
      {previewAttachment && (
        <Modal locale={locale} title={previewAttachment.name} onClose={() => setPreviewAttachment(null)} wide>
          <img className="conversation-dock__attachment-full" src={previewAttachment.previewUrl} alt={previewAttachment.name} />
        </Modal>
      )}
    </>
  );
};

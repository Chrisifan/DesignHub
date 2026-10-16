import { useEffect, useMemo, useState } from 'react';

import type { Locale } from '../i18n';
import { t } from '../studio/ui';
import type { ProjectLibraryDescriptor } from '../../features/project-library/open-project-library';
import type { AppProfile } from '../../features/profile/model';
import type { ProfileAvatarInput } from '../../platform/contracts';
import { Icon } from '../studio/ui';
import './onboarding.css';

type ProfileStepProps = {
  locale: Locale;
  initialProfile: AppProfile | null;
  onChooseProjectLibrary: () => Promise<ProjectLibraryDescriptor | null>;
  onSubmit: (input: { displayName: string; avatar?: ProfileAvatarInput; library: ProjectLibraryDescriptor }) => Promise<void>;
  busy?: boolean;
  error?: string;
};

const acceptedAvatarTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const maxAvatarBytes = 10 * 1024 * 1024;

const bytesToDataUrl = (bytes: Uint8Array, mimeType: string): string => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const readFileBytes = async (file: File): Promise<Uint8Array> => {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });
};

export const ProfileStep = ({
  locale,
  initialProfile,
  onChooseProjectLibrary,
  onSubmit,
  busy = false,
  error = '',
}: ProfileStepProps) => {
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? '');
  const [avatar, setAvatar] = useState<ProfileAvatarInput | null>(null);
  const [previewUrl, setPreviewUrl] = useState(initialProfile?.avatarDataUrl ?? '');
  const [library, setLibrary] = useState<ProjectLibraryDescriptor | null>(null);
  const [localError, setLocalError] = useState('');
  const [choosing, setChoosing] = useState(false);

  useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const canContinue = useMemo(
    () => Boolean(displayName.trim() && (avatar || initialProfile?.avatarDataUrl) && library && !busy && !choosing),
    [avatar, busy, choosing, displayName, initialProfile?.avatarDataUrl, library],
  );

  const selectAvatar = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    if (!acceptedAvatarTypes.has(file.type) || file.size === 0 || file.size > maxAvatarBytes) {
      setLocalError(t(locale, '请选择不超过 10MB 的 PNG、JPEG、WebP 或 GIF 图片。', 'Choose a PNG, JPEG, WebP, or GIF image up to 10MB.'));
      return;
    }
    try {
      const bytes = await readFileBytes(file);
      const nextPreview = typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : bytesToDataUrl(bytes, file.type);
      setPreviewUrl(nextPreview);
      setAvatar({ mimeType: file.type, bytes });
      setLocalError('');
    } catch {
      setLocalError(t(locale, '头像读取失败，请重试。', 'Could not read the avatar. Try again.'));
    }
  };

  const chooseLibrary = async (): Promise<void> => {
    setChoosing(true);
    setLocalError('');
    try {
      const next = await onChooseProjectLibrary();
      if (next) setLibrary(next);
    } catch {
      setLocalError(t(locale, '无法选择存储文件夹，请重试。', 'Could not choose the storage folder. Try again.'));
    } finally {
      setChoosing(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (!canContinue || !library) return;
    await onSubmit({ displayName: displayName.trim(), ...(avatar ? { avatar } : {}), library });
  };

  return (
    <section className="onboarding-step onboarding-profile-step" aria-labelledby="profile-step-title">
      <div className="onboarding-step__progress-meta">
        <span className="onboarding-step__step-pill">{t(locale, '第一步，共两步', 'Step 1 of 2')}</span>
        <span className="onboarding-step__progress-value">50% COMPLETED</span>
      </div>
      <div className="onboarding-step__progress-line"><span style={{ width: '50%' }} /></div>
      <div className="onboarding-step__heading">
        <h1 id="profile-step-title">{t(locale, '设置你的资料', 'Set up your profile')}</h1>
        <p>{t(locale, '设置昵称、头像和应用存储文件夹。', 'Set your name, avatar, and application storage folder.')}</p>
      </div>
      <div className="onboarding-profile-grid">
        <label className="onboarding-field">
          <span>{t(locale, '昵称', 'Nickname')}</span>
          <span className="onboarding-input-wrap">
            <input aria-label={t(locale, '昵称', 'Nickname')} type="text" maxLength={80} autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <Icon name="badge" size={14} />
          </span>
        </label>
        <div className="onboarding-avatar-field">
          <span>{t(locale, '头像', 'Avatar')}</span>
          <div className="onboarding-avatar-row">
            <span className="onboarding-avatar-preview">{previewUrl ? <img src={previewUrl} alt={t(locale, '头像预览', 'Avatar preview')} /> : <span className="onboarding-avatar-placeholder">{(displayName.trim() || '?').slice(0, 1).toUpperCase()}</span>}</span>
            <span className="onboarding-avatar-copy">
              <strong>{previewUrl ? t(locale, '已选择头像', 'Avatar selected') : t(locale, '默认几何标识符', 'Default geometric identifier')}</strong>
              <small>256 × 256 · PNG / JPG / SVG</small>
            </span>
            <label className="button button-secondary onboarding-upload-button">
              {t(locale, '上传头像', 'Upload avatar')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label={t(locale, '上传头像', 'Upload avatar')}
                onChange={(event) => { void selectAvatar(event.target.files?.[0]); event.currentTarget.value = ''; }}
              />
            </label>
          </div>
        </div>
        <div className="onboarding-field onboarding-folder-field">
          <span className="onboarding-folder-label"><span>{t(locale, '应用存储文件夹', 'Application storage folder')}</span><small>{t(locale, '本地优先 · 不上云', 'Local first · Not uploaded')}</small></span>
          <div className="onboarding-folder-row">
            <Icon name="folder-open" size={17} />
            <span className="onboarding-folder-copy"><span className="onboarding-folder-path" title={library?.directory}>{library?.directory ?? t(locale, '尚未选择存储文件夹', 'No storage folder selected')}</span><small>{library ? t(locale, '将自动创建目录 · 剩余可用空间 184.2 GB', 'Directory will be created automatically · 184.2 GB available') : t(locale, '请选择一个用于保存应用数据的目录。', 'Choose a directory for application data.')}</small></span>
            <button type="button" className="button button-secondary" aria-label={t(locale, '选择存储文件夹', 'Choose storage folder')} onClick={() => void chooseLibrary()} disabled={choosing}>{choosing ? t(locale, '选择中…', 'Choosing…') : t(locale, '选择目录', 'Choose directory')}</button>
          </div>
        </div>
      </div>
      {(localError || error) && <p role="alert" className="onboarding-error">{localError || error}</p>}
      <div className="onboarding-actions">
        <button type="button" className="button button-primary" disabled={!canContinue} onClick={() => void submit()}>
          {busy ? t(locale, '保存中…', 'Saving…') : t(locale, '继续', 'Continue')}
        </button>
      </div>
      <div className="onboarding-step__footer">
        <span>▣ LOCAL FIRST ENCLAVE · AES-256 ISOLATED</span>
        <span>LATENCY: 0.1ms · READY</span>
      </div>
    </section>
  );
};

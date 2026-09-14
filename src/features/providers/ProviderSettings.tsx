import { useEffect, useState } from 'react';

import type { Locale } from '../../app/i18n';
import { Badge, Button, Field, Icon, Select, t } from '../../app/studio/ui';
import { normalizeProviderConfig, providerCredentialAccount, type ImageTransport, type ProviderCapability, type ProviderConfig, type ProviderConfigMap, type ProviderProfile } from './config';
import type { GeneratedImage } from './adapter';
import type { ImageGenerationTestResult } from '../agent/task-service';
import type { ProviderConnection } from './connection';

export type ProviderSettingsProps = {
  locale: Locale;
  connections: readonly ProviderConnection[];
  onStoreCredential: (connectionId: string, secret: string) => Promise<boolean>;
  onDeleteCredential: (connectionId: string) => Promise<boolean>;
  onCheckCredential?: (connectionId: string) => Promise<boolean>;
  configs?: ProviderConfigMap;
  onSaveProviderConfig?: (connectionId: string, config: ProviderConfig) => Promise<boolean>;
  onTestImageGeneration?: (connectionId: string, input: { prompt: string; model?: string; size?: string }) => Promise<ImageGenerationTestResult | null>;
  activeProfile?: ProviderProfile;
  onActiveProfileChange?: (profile: ProviderProfile) => void;
};

type ConversationDraft = {
  baseUrl: string;
  models: Record<'conversation' | 'vision-analysis', string>;
};

type ImageDraft = {
  baseUrl: string;
  imageTransport: ImageTransport;
  models: Record<'image-generation' | 'image-editing', string>;
};

type ProviderConfigDraft = {
  conversation: ConversationDraft;
  image: ImageDraft;
};

const emptyProviderConfigs: ProviderConfigMap = {};
const profiles: readonly ProviderProfile[] = ['conversation', 'image'];
const connectionTestPrompts = [
  'A clean editorial poster with a single orange chair on a pale blue background',
  'A warm still life of a ceramic vase, folded paper and a green leaf in soft daylight',
  'A geometric abstract composition in cobalt blue, vermilion and cream with crisp edges',
];

const emptyConfigDraft = (): ProviderConfigDraft => ({
  conversation: { baseUrl: '', models: { conversation: '', 'vision-analysis': '' } },
  image: { baseUrl: '', imageTransport: 'images', models: { 'image-generation': '', 'image-editing': '' } },
});

const configDraftFrom = (config: ProviderConfig | undefined): ProviderConfigDraft => {
  const normalized = config ? normalizeProviderConfig(config) : null;
  return {
    conversation: {
      baseUrl: normalized?.conversation.baseUrl ?? '',
      models: {
        conversation: normalized?.conversation.models.conversation ?? '',
        'vision-analysis': normalized?.conversation.models['vision-analysis'] ?? '',
      },
    },
    image: {
      baseUrl: normalized?.image.baseUrl ?? '',
      imageTransport: normalized?.image.imageTransport ?? 'images',
      models: {
        'image-generation': normalized?.image.models['image-generation'] ?? '',
        'image-editing': normalized?.image.models['image-editing'] ?? '',
      },
    },
  };
};

const modelLabel = (locale: Locale, capability: ProviderCapability): string => {
  if (capability === 'conversation') return t(locale, '对话模型', 'Conversation model');
  if (capability === 'vision-analysis') return t(locale, '视觉模型', 'Vision model');
  if (capability === 'image-generation') return t(locale, '生成模型', 'Image generation model');
  return t(locale, '编辑模型', 'Image editing model');
};

const profileTitle = (locale: Locale, profile: ProviderProfile): string => profile === 'conversation'
  ? t(locale, '对话与视觉', 'Conversation and vision')
  : t(locale, '图片生成与编辑', 'Image generation and editing');

export const ProviderSettings = ({
  locale,
  connections,
  onStoreCredential,
  onDeleteCredential,
  onCheckCredential,
  configs = emptyProviderConfigs,
  onSaveProviderConfig,
  onTestImageGeneration,
  activeProfile,
}: ProviderSettingsProps) => {
  const [selectedId, setSelectedId] = useState(connections[0]?.id ?? '');
  const [configured, setConfigured] = useState<Record<ProviderProfile, boolean>>({ conversation: false, image: false });
  const [secrets, setSecrets] = useState<Record<ProviderProfile, string>>({ conversation: '', image: '' });
  const [message, setMessage] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<ImageGenerationTestResult | null>(null);
  const [configDraft, setConfigDraft] = useState<ProviderConfigDraft>(() => emptyConfigDraft());
  const selected = connections.find((connection) => connection.id === selectedId);
  const visibleProfiles: readonly ProviderProfile[] = activeProfile ? [activeProfile] : profiles;

  useEffect(() => {
    if (!selectedId) return undefined;
    setConfigured({ conversation: selected?.status === 'connected', image: selected?.status === 'connected' });
    if (!onCheckCredential) return undefined;
    let cancelled = false;
    void Promise.all(profiles.map(async (profile) => [profile, await onCheckCredential(providerCredentialAccount(selectedId, profile))] as const))
      .then((entries) => {
        if (cancelled) return;
        setConfigured(Object.fromEntries(entries) as Record<ProviderProfile, boolean>);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [onCheckCredential, selected?.status, selectedId]);

  useEffect(() => {
    setConfigDraft(configDraftFrom(configs[selectedId as keyof ProviderConfigMap]));
    setTestResult(null);
    setMessage('');
  }, [configs, selectedId]);

  const saveConfig = async () => {
    if (!selected || !onSaveProviderConfig) return;
    const conversationModels: ProviderConfig['conversation']['models'] = {};
    (['conversation', 'vision-analysis'] as const).forEach((capability) => {
      const model = configDraft.conversation.models[capability].trim();
      if (model) conversationModels[capability] = model;
    });
    const imageModels: ProviderConfig['image']['models'] = {};
    (['image-generation', 'image-editing'] as const).forEach((capability) => {
      const model = configDraft.image.models[capability].trim();
      if (model) imageModels[capability] = model;
    });
    const config = normalizeProviderConfig({
      conversation: { baseUrl: configDraft.conversation.baseUrl, models: conversationModels },
      image: { baseUrl: configDraft.image.baseUrl, imageTransport: configDraft.image.imageTransport, models: imageModels },
    });
    if (!config) {
      setMessage(t(locale, '请填写有效服务地址。', 'Enter valid service URLs.'));
      return;
    }
    const saved = await onSaveProviderConfig(selected.id, config).catch(() => false);
    setMessage(saved ? t(locale, '连接配置已保存。', 'Connection configuration saved.') : t(locale, '无法保存连接配置，请重试。', 'Connection configuration could not be saved. Try again.'));
  };

  const submitCredential = async (profile: ProviderProfile) => {
    if (!selected || !secrets[profile]) return;
    const account = providerCredentialAccount(selected.id, profile);
    const stored = await onStoreCredential(account, secrets[profile]);
    setSecrets((current) => ({ ...current, [profile]: '' }));
    if (stored) setConfigured((current) => ({ ...current, [profile]: true }));
    setMessage(
      stored
        ? t(locale, '凭据已保存到系统安全存储。', 'Credential saved to system secure storage.')
        : t(locale, '无法保存凭据，请检查系统安全存储。', 'Credential could not be saved. Check system secure storage.'),
    );
  };

  const removeCredential = async (profile: ProviderProfile) => {
    if (!selected) return;
    const deleted = await onDeleteCredential(providerCredentialAccount(selected.id, profile));
    if (deleted) setConfigured((current) => ({ ...current, [profile]: false }));
    setMessage(
      deleted
        ? t(locale, '凭据已删除。', 'Credential deleted.')
        : t(locale, '无法删除凭据，请重试。', 'Credential could not be deleted. Try again.'),
    );
  };

  const testImageGeneration = async (): Promise<void> => {
    if (!selected || !onTestImageGeneration || !configured.image || !configDraft.image.baseUrl.trim()) return;
    setTestBusy(true);
    setTestResult(null);
    const prompt = connectionTestPrompts[Math.floor(Math.random() * connectionTestPrompts.length)] ?? connectionTestPrompts[0];
    try {
      const result = await onTestImageGeneration(selected.id, {
        prompt,
        ...(configDraft.image.models['image-generation'].trim() ? { model: configDraft.image.models['image-generation'].trim() } : {}),
        size: '1024x1024',
      });
      if (!result?.image) throw new Error('IMAGE_RESULT_EMPTY');
      setTestResult(result);
      setMessage(t(locale, '图片生成连接测试成功。', 'Image generation connection test succeeded.'));
    } catch {
      setMessage(t(locale, '图片生成连接测试失败，请检查地址、密钥和模型。', 'Image generation connection test failed. Check the URL, key and model.'));
    } finally {
      setTestBusy(false);
    }
  };

  const testImageSource = (image: GeneratedImage): string | undefined => {
    if (image.base64) return image.base64.startsWith('data:') ? image.base64 : `data:${image.mimeType ?? 'image/png'};base64,${image.base64}`;
    return image.url;
  };

  const renderProfile = (profile: ProviderProfile) => {
    const isImage = profile === 'image';
    const profileDraft = configDraft[profile];
    const modelCapabilities = isImage ? (['image-generation', 'image-editing'] as const) : (['conversation', 'vision-analysis'] as const);
    return (
      <section key={profile} className="provider-profile-section" aria-labelledby={`provider-${profile}-title`}>
        <div className="provider-profile-heading">
          <div>
            <h3 id={`provider-${profile}-title`}>{profileTitle(locale, profile)}</h3>
            <p><Badge tone={configured[profile] ? 'success' : ''}>{configured[profile] ? t(locale, '已连接', 'Connected') : t(locale, '未配置', 'Not configured')}</Badge></p>
          </div>
          <span className="provider-profile-capabilities">{isImage ? t(locale, '图片生成、图片编辑', 'Image generation and editing') : t(locale, '对话、视觉分析', 'Conversation and vision analysis')}</span>
        </div>
        <Field label={isImage ? t(locale, '图片服务地址', 'Image base URL') : t(locale, '对话服务地址', 'Conversation base URL')} hint={t(locale, '仅支持 HTTPS，或本机 HTTP 服务。', 'HTTPS is required except for a local HTTP service.')}>
          <input id={isImage ? 'provider-image-base-url' : undefined} aria-label={isImage ? t(locale, '图片服务地址', 'Image base URL') : t(locale, '对话服务地址', 'Conversation base URL')} type="url" autoComplete="off" placeholder="https://api.example.com/v1" value={profileDraft.baseUrl} onChange={(event) => setConfigDraft((current) => ({ ...current, [profile]: { ...current[profile], baseUrl: event.target.value } }))} />
        </Field>
        {isImage && locale === 'zh-CN' && <label className="sr-only" aria-hidden="true" htmlFor="provider-image-base-url">Image base URL</label>}
        {isImage && <Field label={t(locale, '图片传输模式', 'Image transport')}>
          <Select ariaLabel={t(locale, '图片传输模式', 'Image transport')} value={configDraft.image.imageTransport} onChange={(value) => setConfigDraft((current) => ({ ...current, image: { ...current.image, imageTransport: value as ImageTransport } }))} options={[{ value: 'images', label: t(locale, '图片 API', 'Images API') }, { value: 'responses', label: t(locale, 'Responses 图像工具', 'Responses image tool') }]} />
        </Field>}
        <div className="provider-model-grid">
          {modelCapabilities.map((capability) => {
            const value = isImage
              ? configDraft.image.models[capability as 'image-generation' | 'image-editing']
              : configDraft.conversation.models[capability as 'conversation' | 'vision-analysis'];
            return (
              <Field key={capability} label={modelLabel(locale, capability)}>
                <input aria-label={modelLabel(locale, capability)} autoComplete="off" value={value} onChange={(event) => setConfigDraft((current) => ({
                  ...current,
                  [profile]: {
                    ...current[profile],
                    models: { ...current[profile].models, [capability]: event.target.value },
                  },
                }))} />
              </Field>
            );
          })}
        </div>
        {onSaveProviderConfig && <div className="provider-config-actions"><Button type="button" variant="secondary" icon="save" onClick={() => { void saveConfig(); }}>{t(locale, '保存配置', 'Save config')}</Button></div>}
        <form onSubmit={(event) => { event.preventDefault(); void submitCredential(profile); }}>
          <Field label={t(locale, 'API 密钥', 'API key')} hint={t(locale, '输入后仅发送到桌面主进程并立即清空。', 'Sent to the desktop host and cleared immediately after saving.')}>
            <input
              aria-label={`${profileTitle(locale, profile)} ${t(locale, 'API 密钥', 'API key')}`}
              type="password"
              autoComplete="off"
              placeholder={configured[profile] ? t(locale, '输入新密钥以替换已保存密钥', 'Enter a new key to replace the saved key') : undefined}
              value={secrets[profile]}
              onChange={(event) => setSecrets((current) => ({ ...current, [profile]: event.target.value }))}
            />
            <span className="provider-key-status">
              <Badge tone={configured[profile] ? 'success' : ''}>{configured[profile] ? t(locale, '密钥已保存', 'Key saved') : t(locale, '未保存密钥', 'No key saved')}</Badge>
            </span>
          </Field>
          <div data-testid={`${profile}-key-actions`} className="provider-key-actions">
            <Button type="submit" variant="primary" icon="lock" disabled={!secrets[profile]}>{t(locale, '保存密钥', 'Save key')}</Button>
            <Button type="button" variant="secondary" icon="trash-2" onClick={() => { void removeCredential(profile); }}>{t(locale, '删除密钥', 'Delete key')}</Button>
          </div>
        </form>
        {isImage && onTestImageGeneration && <div className="provider-test-actions">
          <Button type="button" variant="ai" icon="image" disabled={testBusy || !configured.image || !configDraft.image.baseUrl.trim()} onClick={() => { void testImageGeneration(); }}>
            {testBusy ? t(locale, '生成测试图…', 'Generating test image…') : t(locale, '测试图片生成', 'Test image generation')}
          </Button>
          <small>{t(locale, '使用随机提示词生成一张临时预览，不会写入任务或素材库。', 'Generates one temporary preview with a random prompt; nothing is added to tasks or assets.')}</small>
        </div>}
        {isImage && testResult && testImageSource(testResult.image) && <div className="provider-test-result">
          <img src={testImageSource(testResult.image)} alt={t(locale, '连接测试结果', 'Connection test result')} />
          <small>{t(locale, '临时预览', 'Temporary preview')}</small>
        </div>}
      </section>
    );
  };

  return (
    <section aria-labelledby="provider-settings-title" className="provider-settings">
      <div className="settings-section-heading">
        <span className="settings-icon"><Icon name="plug" size={19} /></span>
        <div>
          <h2 id="provider-settings-title">{t(locale, '连接配置', 'Connection setup')}</h2>
          <p>{t(locale, '服务地址和模型保存在本机；密钥仅写入系统安全存储。', 'Endpoint and models stay on this device; keys are written only to system secure storage.')}</p>
        </div>
      </div>
      {connections.length === 0 ? (
        <p>{t(locale, '暂无可用连接适配器。', 'No connection adapters are available.')}</p>
      ) : (
        <>
          <Field label={t(locale, '连接', 'Connection')}>
            <Select ariaLabel={t(locale, '连接', 'Connection')} value={selectedId} onChange={setSelectedId} options={connections.map((connection) => ({ value: connection.id, label: connection.label }))} />
          </Field>
          {selected && <div>
            <p>{t(locale, '能力', 'Capabilities')}: {selected.capabilities.join(', ')}</p>
            {visibleProfiles.map(renderProfile)}
            {message && <p role="status">{message}</p>}
          </div>}
        </>
      )}
    </section>
  );
};

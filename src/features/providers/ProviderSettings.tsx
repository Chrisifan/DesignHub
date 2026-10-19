import { useEffect, useRef, useState } from 'react';

import type { Locale } from '../../app/i18n';
import { Badge, Button, Field, IconButton, Select, t } from '../../app/studio/ui';
import { normalizeProviderConfig, providerCredentialAccount, type ImageTransport, type ProviderCapability, type ProviderConfig, type ProviderConfigMap, type ProviderProfile } from './config';
import type { GeneratedImage } from './adapter';
import type { ConversationTestResult, ImageGenerationTestResult } from '../agent/task-service';
import type { ProviderConnection } from './connection';

export type ProviderSettingsProps = {
  locale: Locale;
  connections: readonly ProviderConnection[];
  onStoreCredential: (connectionId: string, secret: string) => Promise<boolean>;
  onDeleteCredential: (connectionId: string) => Promise<boolean>;
  onCheckCredential?: (connectionId: string) => Promise<boolean>;
  configs?: ProviderConfigMap;
  onSaveProviderConfig?: (connectionId: string, config: ProviderConfig) => Promise<boolean>;
  onTestConversation?: (connectionId: string, input: { model?: string }) => Promise<ConversationTestResult | null>;
  onTestImageGeneration?: (connectionId: string, input: { prompt: string; model?: string; size?: string }) => Promise<ImageGenerationTestResult | null>;
  activeProfile?: ProviderProfile;
  onActiveProfileChange?: (profile: ProviderProfile) => void;
  onActionsChange?: (actions: ProviderSettingsActions | null) => void;
};

export type ProviderSettingsActions = {
  saveConfig: () => Promise<void>;
  canSaveConfig: boolean;
  testConversation: () => void;
  showTestConversation: boolean;
  canTestConversation: boolean;
  testImageGeneration: () => void;
  testBusy: boolean;
  showTestImage: boolean;
  canTestImage: boolean;
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
const maskedSecret = '********';
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

const testErrorMessage = (locale: Locale, error: unknown, profile: ProviderProfile): string => {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const message = raw.replace(/[\r\n\t]+/gu, ' ').trim().slice(0, 320);
  const tlsCode = message.match(/\b(?:DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|ERR_TLS_CERT_ALTNAME_INVALID|CERT_HAS_EXPIRED|UNABLE_TO_GET_ISSUER_CERT_LOCALLY|UNABLE_TO_VERIFY_LEAF_SIGNATURE)\b/u)?.[0];
  if (message.includes('PROVIDER_TLS_ERROR') || tlsCode || /(?:certificate|self[- ]signed|TLS|SSL)/iu.test(message)) {
    return t(
      locale,
      `TLS 证书校验失败，请求尚未发送到服务端的 HTTP 接口。${tlsCode ? `证书错误：${tlsCode}。` : ''}`,
      `TLS certificate validation failed before an HTTP request was sent.${tlsCode ? ` Certificate error: ${tlsCode}.` : ''}`,
    );
  }
  if (message.includes('PROVIDER_API_KEY_REQUIRED')) {
    return t(locale, '未找到已保存的 API 密钥，请求尚未发出。请重新保存密钥后再试。', 'No saved API key was available. The request was not sent. Save the key again and retry.');
  }
  if (message.includes('SYSTEM_CREDENTIAL_STORE_READ_FAILED')) {
    return t(locale, '无法从系统安全存储读取 API 密钥，请求尚未发出。请重新保存密钥。', 'The API key could not be read from secure storage. The request was not sent. Save the key again.');
  }
  if (message.includes('PROVIDER_BASE_URL_REQUIRED') || message.includes('INVALID_PROVIDER_CONFIG')) {
    return t(locale, '连接地址配置无效，请求尚未发出。请保存当前配置后重试。', 'The connection URL configuration is invalid. The request was not sent. Save the current configuration and retry.');
  }
  if (message.includes('PROVIDER_CONFIG_SAVE_FAILED')) {
    return t(locale, '当前连接配置未能保存，因此未执行测试。', 'The current connection configuration could not be saved, so the test was not run.');
  }
  if (message.includes('PROVIDER_TEST_TIMEOUT')) {
    return t(locale, '连接测试超时，请检查网络或服务状态。', 'The connection test timed out. Check the network or provider status.');
  }
  const label = profile === 'conversation'
    ? t(locale, '对话连接测试失败', 'Conversation connection test failed')
    : t(locale, '图片生成连接测试失败', 'Image generation connection test failed');
  return message ? `${label}: ${message}` : `${label}。`;
};

export const ProviderSettings = ({
  locale,
  connections,
  onStoreCredential,
  onDeleteCredential,
  onCheckCredential,
  configs = emptyProviderConfigs,
  onSaveProviderConfig,
  onTestConversation,
  onTestImageGeneration,
  activeProfile,
  onActionsChange,
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
  const applyConfigured = (next: Record<ProviderProfile, boolean>): void => {
    setConfigured(next);
    setSecrets((current) => {
      const updated = { ...current };
      profiles.forEach((profile) => {
        if (!next[profile]) updated[profile] = '';
        else if (!updated[profile]) updated[profile] = maskedSecret;
      });
      return updated;
    });
  };

  useEffect(() => {
    if (!selectedId) return undefined;
    if (!onCheckCredential) {
      const fallback = selected?.status === 'connected';
      applyConfigured({ conversation: fallback, image: fallback });
      return undefined;
    }
    applyConfigured({ conversation: false, image: false });
    let cancelled = false;
    void Promise.all(profiles.map(async (profile) => [profile, await onCheckCredential(providerCredentialAccount(selectedId, profile))] as const))
      .then((entries) => {
        if (cancelled) return;
        applyConfigured(Object.fromEntries(entries) as Record<ProviderProfile, boolean>);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [onCheckCredential, selected?.status, selectedId]);

  useEffect(() => {
    setConfigDraft(configDraftFrom(configs[selectedId as keyof ProviderConfigMap]));
    setTestResult(null);
    setMessage('');
  }, [configs, selectedId]);

  const configFromDraft = (): ProviderConfig | null => {
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
    return normalizeProviderConfig({
      conversation: { baseUrl: configDraft.conversation.baseUrl, models: conversationModels },
      image: { baseUrl: configDraft.image.baseUrl, imageTransport: configDraft.image.imageTransport, models: imageModels },
    });
  };

  const saveConfig = async () => {
    if (!selected || !onSaveProviderConfig) return;
    const config = configFromDraft();
    if (!config) {
      setMessage(t(locale, '请填写有效服务地址。', 'Enter valid service URLs.'));
      return;
    }
    const saved = await onSaveProviderConfig(selected.id, config).catch(() => false);
    setMessage(saved ? t(locale, '连接配置已保存。', 'Connection configuration saved.') : t(locale, '无法保存连接配置，请重试。', 'Connection configuration could not be saved. Try again.'));
  };

  const submitCredential = async (profile: ProviderProfile) => {
    if (!selected || !secrets[profile] || secrets[profile] === maskedSecret) return;
    const account = providerCredentialAccount(selected.id, profile);
    const stored = await onStoreCredential(account, secrets[profile]);
    setSecrets((current) => ({ ...current, [profile]: stored || configured[profile] ? maskedSecret : '' }));
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
    if (deleted) {
      setConfigured((current) => ({ ...current, [profile]: false }));
      setSecrets((current) => ({ ...current, [profile]: '' }));
    }
    setMessage(
      deleted
        ? t(locale, '凭据已删除。', 'Credential deleted.')
        : t(locale, '无法删除凭据，请重试。', 'Credential could not be deleted. Try again.'),
    );
  };

  const testConversation = async (): Promise<void> => {
    if (!selected || !onTestConversation || !configured.conversation || !configDraft.conversation.baseUrl.trim()) return;
    setTestBusy(true);
    try {
      if (onSaveProviderConfig) {
        const config = configFromDraft();
        if (!config || !await onSaveProviderConfig(selected.id, config).catch(() => false)) throw new Error('PROVIDER_CONFIG_SAVE_FAILED');
      }
      const model = configDraft.conversation.models.conversation.trim();
      const result = await onTestConversation(selected.id, model ? { model } : {});
      if (!result) throw new Error('CONVERSATION_TEST_FAILED');
      setMessage(t(locale, '对话连接测试成功。', 'Conversation connection test succeeded.'));
    } catch (error) {
      setMessage(testErrorMessage(locale, error, 'conversation'));
    } finally {
      setTestBusy(false);
    }
  };

  const testImageGeneration = async (): Promise<void> => {
    if (!selected || !onTestImageGeneration || !configured.image || !configDraft.image.baseUrl.trim()) return;
    setTestBusy(true);
    setTestResult(null);
    const prompt = connectionTestPrompts[Math.floor(Math.random() * connectionTestPrompts.length)] ?? connectionTestPrompts[0];
    try {
      if (onSaveProviderConfig) {
        const config = configFromDraft();
        if (!config || !await onSaveProviderConfig(selected.id, config).catch(() => false)) throw new Error('PROVIDER_CONFIG_SAVE_FAILED');
      }
      const result = await onTestImageGeneration(selected.id, {
        prompt,
        ...(configDraft.image.models['image-generation'].trim() ? { model: configDraft.image.models['image-generation'].trim() } : {}),
        size: '1024x1024',
      });
      if (!result?.image) throw new Error('IMAGE_RESULT_EMPTY');
      setTestResult(result);
      setMessage(t(locale, '图片生成连接测试成功。', 'Image generation connection test succeeded.'));
    } catch (error) {
      setMessage(testErrorMessage(locale, error, 'image'));
    } finally {
      setTestBusy(false);
    }
  };

  const saveConfigRef = useRef(saveConfig);
  const testConversationRef = useRef(testConversation);
  const testImageGenerationRef = useRef(testImageGeneration);
  saveConfigRef.current = saveConfig;
  testConversationRef.current = testConversation;
  testImageGenerationRef.current = testImageGeneration;
  const canSaveConfig = Boolean(onSaveProviderConfig);
  const showTestConversation = activeProfile === 'conversation' && Boolean(onTestConversation);
  const canTestConversation = Boolean(showTestConversation && configured.conversation && configDraft.conversation.baseUrl.trim());
  const showTestImage = activeProfile === 'image' && Boolean(onTestImageGeneration);
  const canTestImage = Boolean(showTestImage && configured.image && configDraft.image.baseUrl.trim());

  useEffect(() => {
    onActionsChange?.({
      saveConfig: () => saveConfigRef.current(),
      canSaveConfig,
      testConversation: () => { void testConversationRef.current(); },
      showTestConversation,
      canTestConversation,
      testImageGeneration: () => { void testImageGenerationRef.current(); },
      testBusy,
      showTestImage,
      canTestImage,
    });
  }, [canSaveConfig, canTestConversation, canTestImage, onActionsChange, showTestConversation, showTestImage, testBusy]);
  useEffect(() => () => onActionsChange?.(null), [onActionsChange]);

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
          <div className="provider-profile-title-row">
            <h3 id={`provider-${profile}-title`}>{profileTitle(locale, profile)}</h3>
            <Badge tone={configured[profile] && (selected?.profileStatuses?.[profile] ?? 'connected') === 'connected' ? 'success' : selected?.profileStatuses?.[profile] === 'error' ? 'error' : ''}>
              {configured[profile]
                ? selected?.profileStatuses?.[profile] === 'error'
                  ? t(locale, '连接失败', 'Connection failed')
                  : selected?.profileStatuses?.[profile] === 'unknown'
                    ? t(locale, '待测试', 'Not tested')
                    : t(locale, '已连接', 'Connected')
                : t(locale, '未配置', 'Not configured')}
            </Badge>
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
        <form onSubmit={(event) => { event.preventDefault(); void submitCredential(profile); }}>
          <Field label={<span className="provider-key-label">
            {t(locale, 'API 密钥', 'API key')}
            <Badge tone={configured[profile] ? 'success' : ''}>{configured[profile] ? t(locale, '密钥已保存', 'Key saved') : t(locale, '未保存密钥', 'No key saved')}</Badge>
          </span>} hint={t(locale, '输入后仅发送到桌面主进程并立即清空。', 'Sent to the desktop host and cleared immediately after saving.')}>
            <div className="provider-key-row">
              <input
                aria-label={`${profileTitle(locale, profile)} ${t(locale, 'API 密钥', 'API key')}`}
                type="password"
                autoComplete="off"
                placeholder={configured[profile] ? t(locale, '输入新密钥以替换已保存密钥', 'Enter a new key to replace the saved key') : undefined}
                value={secrets[profile]}
                onFocus={() => { if (secrets[profile] === maskedSecret) setSecrets((current) => ({ ...current, [profile]: '' })); }}
                onChange={(event) => setSecrets((current) => ({ ...current, [profile]: event.target.value }))}
                onBlur={() => { if (configured[profile] && !secrets[profile]) setSecrets((current) => ({ ...current, [profile]: maskedSecret })); }}
              />
              <div data-testid={`${profile}-key-actions`} className="provider-key-actions">
                <IconButton type="submit" name="save" label={t(locale, '保存密钥', 'Save key')} disabled={!secrets[profile] || secrets[profile] === maskedSecret} />
                <IconButton type="button" name="trash-2" label={t(locale, '删除密钥', 'Delete key')} onClick={() => { void removeCredential(profile); }} />
              </div>
            </div>
          </Field>
        </form>
        {isImage && testResult && testImageSource(testResult.image) && <div className="provider-test-result">
          <img src={testImageSource(testResult.image)} alt={t(locale, '连接测试结果', 'Connection test result')} />
          <small>{t(locale, '临时预览', 'Temporary preview')}</small>
        </div>}
        {(!onActionsChange && ((!isImage && onTestConversation) || (isImage && onTestImageGeneration) || onSaveProviderConfig)) ? <div className="provider-profile-actions-row">
          {!isImage && onTestConversation && <Button type="button" variant="ai" icon="plug" disabled={testBusy || !configured.conversation || !configDraft.conversation.baseUrl.trim()} onClick={() => { void testConversation(); }}>
            {testBusy ? t(locale, '测试中…', 'Testing…') : t(locale, '测试连接', 'Test connection')}
          </Button>}
          {isImage && onTestImageGeneration && <div className="provider-test-actions">
            <Button type="button" variant="ai" icon="image" disabled={testBusy || !configured.image || !configDraft.image.baseUrl.trim()} onClick={() => { void testImageGeneration(); }}>
              {testBusy ? t(locale, '测试中…', 'Testing…') : t(locale, '测试生成', 'Test generation')}
            </Button>
            <small>{t(locale, '使用随机提示词生成一张临时预览，不会写入任务或素材库。', 'Generates one temporary preview with a random prompt; nothing is added to tasks or assets.')}</small>
          </div>}
          {onSaveProviderConfig && <div className="provider-config-actions"><Button type="button" variant="secondary" icon="save" onClick={() => { void saveConfig(); }}>{t(locale, '保存配置', 'Save config')}</Button></div>}
        </div> : null}
      </section>
    );
  };

  return (
    <section className="provider-settings">
      {connections.length === 0 ? (
        <p>{t(locale, '暂无可用连接适配器。', 'No connection adapters are available.')}</p>
      ) : (
        <>
          {connections.length > 1 && <Field label={t(locale, '连接', 'Connection')}>
            <Select ariaLabel={t(locale, '连接', 'Connection')} value={selectedId} onChange={setSelectedId} options={connections.map((connection) => ({ value: connection.id, label: connection.label }))} />
          </Field>}
          {selected && <>
            {visibleProfiles.map(renderProfile)}
            {message && <p role="status">{message}</p>}
          </>}
        </>
      )}
    </section>
  );
};

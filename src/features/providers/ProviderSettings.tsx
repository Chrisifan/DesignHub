import { useEffect, useState, type FormEvent } from 'react';

import type { Locale } from '../../app/i18n';
import { Badge, Button, Field, Icon, Select, t } from '../../app/studio/ui';
import { normalizeProviderConfig, providerCapabilities, type ImageTransport, type ProviderCapability, type ProviderConfig, type ProviderConfigMap } from './config';
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
};

type ProviderConfigDraft = {
  baseUrl: string;
  imageTransport: ImageTransport;
  models: Record<ProviderCapability, string>;
};

const emptyProviderConfigs: ProviderConfigMap = {};
const connectionTestPrompts = [
  'A clean editorial poster with a single orange chair on a pale blue background',
  'A warm still life of a ceramic vase, folded paper and a green leaf in soft daylight',
  'A geometric abstract composition in cobalt blue, vermilion and cream with crisp edges',
];

const emptyConfigDraft = (): ProviderConfigDraft => ({
  baseUrl: '',
  imageTransport: 'images',
  models: { conversation: '', 'vision-analysis': '', 'image-generation': '', 'image-editing': '' },
});

const configDraftFrom = (config: ProviderConfig | undefined): ProviderConfigDraft => ({
  baseUrl: config?.baseUrl ?? '',
  imageTransport: config?.imageTransport ?? 'images',
  models: {
    conversation: config?.models.conversation ?? '',
    'vision-analysis': config?.models['vision-analysis'] ?? '',
    'image-generation': config?.models['image-generation'] ?? '',
    'image-editing': config?.models['image-editing'] ?? '',
  },
});

const modelLabel = (locale: Locale, capability: ProviderCapability): string => {
  if (capability === 'conversation') return t(locale, '对话模型', 'Conversation model');
  if (capability === 'vision-analysis') return t(locale, '视觉模型', 'Vision model');
  if (capability === 'image-generation') return t(locale, '生成模型', 'Image generation model');
  return t(locale, '编辑模型', 'Image editing model');
};
export const ProviderSettings = ({
  locale,
  connections,
  onStoreCredential,
  onDeleteCredential,
  onCheckCredential,
  configs = emptyProviderConfigs,
  onSaveProviderConfig,
  onTestImageGeneration,
}: ProviderSettingsProps) => {
  const [selectedId, setSelectedId] = useState(connections[0]?.id ?? '');
  const [configured, setConfigured] = useState<Record<string, boolean>>(() => Object.fromEntries(connections.map((connection) => [connection.id, connection.status === 'connected'])));
  const [secret, setSecret] = useState('');
  const [message, setMessage] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<ImageGenerationTestResult | null>(null);
  const [configDraft, setConfigDraft] = useState<ProviderConfigDraft>(() => emptyConfigDraft());
  const selected = connections.find((connection) => connection.id === selectedId);
  useEffect(() => {
    if (!onCheckCredential || !selectedId) return undefined;
    let cancelled = false;
    void onCheckCredential(selectedId).then((value) => { if (!cancelled) setConfigured((current) => ({ ...current, [selectedId]: value })); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [onCheckCredential, selectedId]);
  useEffect(() => {
    setConfigDraft(configDraftFrom(configs[selectedId as keyof ProviderConfigMap]));
    setTestResult(null);
  }, [configs, selectedId]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || secret.length === 0) return;
    const stored = await onStoreCredential(selected.id, secret);
    setSecret('');
    if (stored) setConfigured((current) => ({ ...current, [selected.id]: true }));
    setMessage(
      stored
        ? t(locale, '凭据已保存到系统安全存储。', 'Credential saved to system secure storage.')
        : t(locale, '无法保存凭据，请检查系统安全存储。', 'Credential could not be saved. Check system secure storage.'),
    );
  };
  const remove = async () => {
    if (!selected) return;
    const deleted = await onDeleteCredential(selected.id);
    if (deleted) setConfigured((current) => ({ ...current, [selected.id]: false }));
    setMessage(
      deleted
        ? t(locale, '凭据已删除。', 'Credential deleted.')
        : t(locale, '无法删除凭据，请重试。', 'Credential could not be deleted. Try again.'),
    );
  };
  const saveConfig = async () => {
    if (!selected || !onSaveProviderConfig) return;
    const models: ProviderConfig['models'] = {};
    providerCapabilities.forEach((capability) => {
      const model = configDraft.models[capability].trim();
      if (model) models[capability] = model;
    });
    const config = normalizeProviderConfig({ baseUrl: configDraft.baseUrl, imageTransport: configDraft.imageTransport, models });
    if (!config) {
      setMessage(t(locale, '请填写有效服务地址。', 'Enter a valid service URL.'));
      return;
    }
    const saved = await onSaveProviderConfig(selected.id, config).catch(() => false);
    setMessage(saved ? t(locale, '连接配置已保存。', 'Connection configuration saved.') : t(locale, '无法保存连接配置，请重试。', 'Connection configuration could not be saved. Try again.'));
  };
  const testImageGeneration = async (): Promise<void> => {
    if (!selected || !onTestImageGeneration || !configured[selected.id] || !configDraft.baseUrl.trim()) return;
    setTestBusy(true);
    setTestResult(null);
    const prompt = connectionTestPrompts[Math.floor(Math.random() * connectionTestPrompts.length)] ?? connectionTestPrompts[0];
    try {
      const result = await onTestImageGeneration(selected.id, {
        prompt,
        ...(configDraft.models['image-generation'].trim() ? { model: configDraft.models['image-generation'].trim() } : {}),
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
          {selected && (
            <div>
              <p><Badge tone={configured[selected.id] ? 'success' : ''}>{configured[selected.id] ? t(locale, '已连接', 'Connected') : t(locale, '未配置', 'Not configured')}</Badge></p>
              <p>{t(locale, '能力', 'Capabilities')}: {selected.capabilities.join(', ')}</p>
              <form onSubmit={submit}>
                <Field label={t(locale, '服务地址', 'Base URL')} hint={t(locale, '仅支持 HTTPS，或本机 HTTP 服务。', 'HTTPS is required except for a local HTTP service.')}>
                  <input aria-label={t(locale, '服务地址', 'Base URL')} type="url" autoComplete="off" placeholder="https://api.example.com/v1" value={configDraft.baseUrl} onChange={(event) => setConfigDraft((current) => ({ ...current, baseUrl: event.target.value }))} />
                </Field>
                <Field label={t(locale, '图片传输模式', 'Image transport')}>
                  <Select ariaLabel={t(locale, '图片传输模式', 'Image transport')} value={configDraft.imageTransport} onChange={(value) => setConfigDraft((current) => ({ ...current, imageTransport: value as ImageTransport }))} options={[{ value: 'images', label: t(locale, '图片 API', 'Images API') }, { value: 'responses', label: t(locale, 'Responses 图像工具', 'Responses image tool') }]} />
                </Field>
                <div className="provider-model-grid">
                  {providerCapabilities.map((capability) => (
                    <Field key={capability} label={modelLabel(locale, capability)}>
                      <input aria-label={modelLabel(locale, capability)} autoComplete="off" value={configDraft.models[capability]} onChange={(event) => setConfigDraft((current) => ({ ...current, models: { ...current.models, [capability]: event.target.value } }))} />
                    </Field>
                  ))}
                </div>
                {onSaveProviderConfig && <div className="provider-config-actions"><Button type="button" variant="secondary" icon="save" disabled={!configDraft.baseUrl.trim()} onClick={() => { void saveConfig(); }}>{t(locale, '保存配置', 'Save config')}</Button></div>}
                {onTestImageGeneration && <div className="provider-test-actions">
                  <Button type="button" variant="ai" icon="image" disabled={testBusy || !configured[selected.id] || !configDraft.baseUrl.trim()} onClick={() => { void testImageGeneration(); }}>
                    {testBusy ? t(locale, '生成测试图…', 'Generating test image…') : t(locale, '测试图片生成', 'Test image generation')}
                  </Button>
                  <small>{t(locale, '使用随机提示词生成一张临时预览，不会写入任务或素材库。', 'Generates one temporary preview with a random prompt; nothing is added to tasks or assets.')}</small>
                </div>}
                {testResult && testImageSource(testResult.image) && <div className="provider-test-result">
                  <img src={testImageSource(testResult.image)} alt={t(locale, '连接测试结果', 'Connection test result')} />
                  <small>{t(locale, '临时预览', 'Temporary preview')}</small>
                </div>}
                <Field label={t(locale, 'API 密钥', 'API key')} hint={t(locale, '输入后仅发送到桌面主进程并立即清空。', 'Sent to the desktop host and cleared immediately after saving.')}>
                  <input aria-label={t(locale, 'API 密钥', 'API key')} type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} />
                </Field>
                <div className="settings-actions">
                  <Button type="submit" variant="primary" icon="lock" disabled={secret.length === 0}>{t(locale, '保存密钥', 'Save key')}</Button>
                  <Button type="button" variant="secondary" icon="trash-2" onClick={remove}>{t(locale, '删除密钥', 'Delete key')}</Button>
                </div>
              </form>
              {message && <p role="status">{message}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
};

import { useCallback, useEffect, useState } from 'react';

import type { Locale } from '../i18n';
import { Button, t } from '../studio/ui';
import { ProviderSettings, type ProviderSettingsActions } from '../../features/providers/ProviderSettings';
import { providerCredentialAccount, providerProfiles, type ProviderConfigMap } from '../../features/providers/config';
import { getProviderProfileStatus, type ProviderConnectionStatusMap } from '../../features/providers/status';
import type { ProviderConnection } from '../../features/providers/connection';
import { getDesktopApi } from '../../platform/runtime';
import './onboarding.css';

type ModelStepProps = {
  locale: Locale;
  onComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
};

const availableConnections: readonly ProviderConnection[] = [
  { id: 'openai-compatible', label: 'OpenAI compatible', status: 'not-configured', capabilities: ['conversation', 'vision-analysis', 'image-generation', 'image-editing'] },
];

export const ModelStep = ({ locale, onComplete, onSkip }: ModelStepProps) => {
  const [connectionState, setConnectionState] = useState<Record<string, boolean>>({});
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigMap>({});
  const [providerStatuses, setProviderStatuses] = useState<ProviderConnectionStatusMap>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [providerActions, setProviderActions] = useState<ProviderSettingsActions | null>(null);
  const statusAware = Boolean(getDesktopApi().loadProviderConnectionStatuses);

  useEffect(() => {
    let cancelled = false;
    const checks = availableConnections.flatMap((connection) => providerProfiles.map(async (profile) => {
      const account = providerCredentialAccount(connection.id, profile);
      return [account, await getDesktopApi().hasCredential?.(account) ?? false] as const;
    }));
    void Promise.all([
      Promise.all(checks),
      getDesktopApi().loadProviderConfigs?.() ?? Promise.resolve(null),
      getDesktopApi().loadProviderConnectionStatuses?.() ?? Promise.resolve(null),
    ]).then(([entries, configs, statuses]) => {
      if (cancelled) return;
      setConnectionState(Object.fromEntries(entries));
      setProviderConfigs(configs ?? {});
      setProviderStatuses(statuses ?? {});
    }).catch(() => {
      if (!cancelled) setError(t(locale, '无法读取模型配置，请稍后重试。', 'Could not read model configuration. Try again later.'));
    });
    return () => { cancelled = true; };
  }, [locale]);

  const checkCredential = useCallback(
    async (connectionId: string) => getDesktopApi().hasCredential?.(connectionId) ?? false,
    [],
  );
  const connections = availableConnections.map((connection) => {
    const profileStatuses = Object.fromEntries(providerProfiles.map((profile) => [
      profile,
      statusAware
        ? getProviderProfileStatus(providerStatuses, connection.id as 'openai-compatible', profile, providerConfigs)
        : connectionState[providerCredentialAccount(connection.id, profile)] ? 'connected' : 'unknown',
    ])) as Record<typeof providerProfiles[number], ReturnType<typeof getProviderProfileStatus>>;
    const credentialConfigured = providerProfiles.some((profile) => connectionState[providerCredentialAccount(connection.id, profile)]);
    const connected = providerProfiles.some((profile) => connectionState[providerCredentialAccount(connection.id, profile)] && profileStatuses[profile] === 'connected');
    return {
      ...connection,
      profileStatuses,
      status: statusAware ? connected ? 'connected' as const : 'not-configured' as const : credentialConfigured ? 'connected' as const : 'not-configured' as const,
    };
  });
  const saveConfig = async (connectionId: string, config: ProviderConfigMap['openai-compatible']): Promise<boolean> => {
    if (!config) return false;
    const saved = await (getDesktopApi().saveProviderConfig?.({ connectionId: connectionId as 'openai-compatible', config }) ?? false);
    if (saved) setProviderConfigs((current) => ({ ...current, [connectionId]: config }));
    return saved;
  };
  const storeCredential = async (connectionId: string, secret: string): Promise<boolean> => {
    const stored = await (getDesktopApi().storeCredential?.(connectionId, secret) ?? false);
    if (stored) setConnectionState((current) => ({ ...current, [connectionId]: true }));
    return stored;
  };
  const deleteCredential = async (connectionId: string): Promise<boolean> => {
    const deleted = await (getDesktopApi().deleteCredential?.(connectionId) ?? false);
    if (deleted) setConnectionState((current) => ({ ...current, [connectionId]: false }));
    return deleted;
  };
  const finish = async (callback: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await callback();
    } catch {
      setError(t(locale, '无法保存引导状态，请重试。', 'Could not save onboarding state. Try again.'));
    } finally {
      setBusy(false);
    }
  };
  const complete = async (): Promise<void> => {
    if (providerActions?.canSaveConfig) await providerActions.saveConfig();
    await onComplete();
  };

  return (
    <section className="onboarding-step onboarding-model-step" aria-labelledby="model-step-title">
      <div className="onboarding-step__progress-meta">
        <span className="onboarding-step__step-pill">{t(locale, '第二步，共两步', 'Step 2 of 2')}</span>
        <span className="onboarding-step__progress-value">100% COMPLETED</span>
      </div>
      <div className="onboarding-step__progress-line"><span style={{ width: '100%' }} /></div>
      <div className="onboarding-step__heading">
        <h1 id="model-step-title">{t(locale, '配置模型连接', 'Configure model connections')}</h1>
        <p>{t(locale, '可现在配置模型，也可以跳过，稍后从设置中完成。', 'Configure models now or skip and finish later from Settings.')}</p>
      </div>
      <div className="onboarding-model-content">
        <ProviderSettings
          locale={locale}
          connections={connections}
          configs={providerConfigs}
          onSaveProviderConfig={saveConfig}
          onActionsChange={setProviderActions}
          onCheckCredential={checkCredential}
          onStoreCredential={storeCredential}
          onDeleteCredential={deleteCredential}
        />
      </div>
      {(error) && <p role="alert" className="onboarding-error">{error}</p>}
      <div className="onboarding-actions onboarding-actions--split">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void finish(onSkip)}>
          {t(locale, '跳过，稍后设置', 'Skip and set up later')}
        </Button>
        <Button type="button" variant="primary" disabled={busy} onClick={() => void finish(complete)}>
          {busy ? t(locale, '保存中…', 'Saving…') : t(locale, '完成并进入首页', 'Finish and open home')}
        </Button>
      </div>
      <div className="onboarding-step__footer">
        <span>▣ LOCAL FIRST ENCLAVE · AES-256 ISOLATED</span>
        <span>TORCH 2.3.1 · READY</span>
      </div>
    </section>
  );
};

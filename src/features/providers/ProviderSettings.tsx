import { useState, type FormEvent } from 'react';

import type { Locale } from '../../app/i18n';
import { Badge, Button, Field, Icon, t } from '../../app/studio/ui';
import type { ProviderConnection } from './connection';

export type ProviderSettingsProps = {
  locale: Locale;
  connections: readonly ProviderConnection[];
  onStoreCredential: (connectionId: string, secret: string) => Promise<boolean>;
  onDeleteCredential: (connectionId: string) => Promise<boolean>;
};
export const ProviderSettings = ({
  locale,
  connections,
  onStoreCredential,
  onDeleteCredential,
}: ProviderSettingsProps) => {
  const [selectedId, setSelectedId] = useState(connections[0]?.id ?? '');
  const [secret, setSecret] = useState('');
  const [message, setMessage] = useState('');
  const selected = connections.find((connection) => connection.id === selectedId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || secret.length === 0) return;
    const stored = await onStoreCredential(selected.id, secret);
    setSecret('');
    setMessage(
      stored
        ? t(locale, '凭据已保存到系统安全存储。', 'Credential saved to system secure storage.')
        : t(locale, '无法保存凭据，请检查系统安全存储。', 'Credential could not be saved. Check system secure storage.'),
    );
  };
  const remove = async () => {
    if (!selected) return;
    const deleted = await onDeleteCredential(selected.id);
    setMessage(
      deleted
        ? t(locale, '凭据已删除。', 'Credential deleted.')
        : t(locale, '无法删除凭据，请重试。', 'Credential could not be deleted. Try again.'),
    );
  };
  return (
    <section aria-labelledby="provider-settings-title" className="settings-section">
      <div className="settings-section-heading">
        <span className="settings-icon"><Icon name="plug" size={19} /></span>
        <div>
          <h2 id="provider-settings-title">{t(locale, '模型连接', 'Model connections')}</h2>
          <p>{t(locale, '密钥仅写入系统安全存储，不会读回界面。', 'Keys are written to system secure storage and never read back into the interface.')}</p>
        </div>
      </div>
      {connections.length === 0 ? (
        <p>{t(locale, '暂无可用连接适配器。', 'No connection adapters are available.')}</p>
      ) : (
        <>
          <Field label={t(locale, '连接', 'Connection')}>
            <select aria-label={t(locale, '连接', 'Connection')} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.label}</option>)}
            </select>
          </Field>
          {selected && (
            <div>
              <p><Badge tone={selected.status === 'connected' ? 'success' : ''}>{selected.status === 'connected' ? t(locale, '已连接', 'Connected') : t(locale, '未配置', 'Not configured')}</Badge></p>
              <p>{t(locale, '能力', 'Capabilities')}: {selected.capabilities.join(', ')}</p>
              <form onSubmit={submit}>
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

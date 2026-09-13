import { useState } from 'react';
import { Select } from '../../app/studio/ui';
import { buildDiagnosticPreview, serializeDiagnosticPackage, type DiagnosticInput } from './diagnostics';

export type SettingsViewProps = { initial?: DiagnosticInput; onLocaleChange?: (locale: 'zh-CN' | 'en') => void };

export const SettingsView = ({ initial = { runtime: 'Electron' }, onLocaleChange }: SettingsViewProps) => {
  const [locale, setLocale] = useState<'zh-CN' | 'en'>('zh-CN');
  const [preview, setPreview] = useState(() => buildDiagnosticPreview(initial));
  const changeLocale = (next: 'zh-CN' | 'en') => { setLocale(next); onLocaleChange?.(next); };
  const exportPreview = () => { const content = serializeDiagnosticPackage(initial); setPreview(JSON.parse(content) as typeof preview); };
  return (
    <section className="settings-view" aria-label={locale === 'zh-CN' ? '设置' : 'Settings'}>
      <label>Language<Select ariaLabel="Language" value={locale} onChange={(value) => changeLocale(value as 'zh-CN' | 'en')} options={[{ value: 'zh-CN', label: '中文' }, { value: 'en', label: 'English' }]} /></label>
      <button type="button" onClick={exportPreview}>{locale === 'zh-CN' ? '预览诊断' : 'Preview diagnostics'}</button>
      <pre aria-label="Diagnostic preview">{JSON.stringify(preview, null, 2)}</pre>
    </section>
  );
};

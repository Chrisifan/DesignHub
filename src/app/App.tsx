import { useEffect, useState } from 'react';

import { getMessages, type Locale } from './i18n';
import { WindowBar } from './shell/WindowBar';
import { getDesktopApi } from '../platform/desktop';
import './styles/tokens.css';
import './styles/window.css';

export const App = () => {
  const [locale, setLocale] = useState<Locale>('zh-CN');
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system');
  const copy = getMessages(locale);
  const nativeControlSide = navigator.userAgent.includes('Mac') ? 'left' : 'right';
  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
      return;
    }
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);
  const chooseWorkspaceDirectory = async (): Promise<void> => {
    await getDesktopApi().chooseWorkspaceDirectory();
  };

  return (
    <main className="app-shell" aria-label={copy.appName} data-theme={theme}>
      <WindowBar copy={copy} nativeControlSide={nativeControlSide} />
      <section className="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">{copy.appName}</p>
        <h1 id="welcome-title">{copy.welcomeTitle}</h1>
        <p className="welcome-description">{copy.welcomeDescription}</p>
        <div className="welcome-actions">
          <button type="button" className="button button-primary" aria-label={copy.newWorkspaceLabel}>
            {copy.newWorkspace}
          </button>
          <button type="button" className="button button-secondary" aria-label={copy.openWorkspaceLabel} onClick={chooseWorkspaceDirectory}>
            {copy.openWorkspace}
          </button>
        </div>
        <button
          type="button"
          className="language-toggle"
          onClick={() => setLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')}
          aria-label={locale === 'zh-CN' ? 'Switch to English' : '切换中文'}
        >
          {locale === 'zh-CN' ? 'EN' : '中文'}
        </button>
        <label className="theme-select-label">
          <span>{copy.themeLabel}</span>
          <select className="theme-select" value={theme} onChange={(event) => setTheme(event.target.value as 'system' | 'dark' | 'light')}>
            <option value="system">{copy.themeSystem}</option>
            <option value="dark">{copy.themeDark}</option>
            <option value="light">{copy.themeLight}</option>
          </select>
        </label>
      </section>
    </main>
  );
};

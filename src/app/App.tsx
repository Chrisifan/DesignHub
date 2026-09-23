import { useEffect, useRef, useState } from 'react';

import { getMessages, type Locale } from './i18n';
import { WindowBar } from './shell/WindowBar';
import { Studio } from './studio/Studio';
import { t } from './studio/ui';
import type { Theme } from './studio/types';
import type { WorkspaceDescriptor } from '../features/workspace/open-workspace';
import type { ProjectLibraryDescriptor, ProjectLibraryStatus } from '../features/project-library/open-project-library';
import { getDesktopApi } from '../platform/desktop';
import { usePointerDotBackground } from './usePointerDotBackground';
import './styles/tokens.css';
import './styles/window.css';

const readPreference = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const savePreference = (key: string, value: string): void => {
  try { localStorage.setItem(key, value); } catch { /* in-memory fallback */ }
};

const toStudioWorkspace = (library: ProjectLibraryDescriptor): WorkspaceDescriptor => ({
  workspaceId: library.libraryId,
  name: library.directory.split(/[\\/]/u).filter(Boolean).at(-1) ?? 'Project library',
  directory: library.directory,
  formatVersion: library.formatVersion,
  openMode: library.openMode,
});

export const App = () => {
  const [locale, setLocale] = useState<Locale>(() => readPreference('designhub.ui.locale') === 'en' ? 'en' : 'zh-CN');
  const [theme, setTheme] = useState<Theme>(() => {
    const value = readPreference('designhub.ui.theme');
    return value === 'dark' || value === 'light' ? value : 'system';
  });
  const [libraryStatus, setLibraryStatus] = useState<ProjectLibraryStatus>({ state: 'unselected' });
  const [error, setError] = useState('');
  const appShellRef = useRef<HTMLElement>(null);
  usePointerDotBackground(appShellRef);
  const copy = getMessages(locale);
  const nativeControlSide = navigator.userAgent.includes('Mac') ? 'left' : 'right';
  const changeLocale = (value: Locale) => { setLocale(value); savePreference('designhub.ui.locale', value); };
  const changeTheme = (value: Theme) => { setTheme(value); savePreference('designhub.ui.theme', value); };

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);
  useEffect(() => {
    let cancelled = false;
    const statusReader = getDesktopApi().getProjectLibraryStatus;
    if (!statusReader) return () => { cancelled = true; };
    void statusReader().then((status) => {
      if (!cancelled && status) setLibraryStatus(status);
    }).catch(() => {
      if (!cancelled) setError(t(locale, '无法读取项目库状态。', 'Could not read project library status.'));
    });
    return () => { cancelled = true; };
  }, [locale]);

  const chooseProjectLibrary = async (): Promise<void> => {
    setError('');
    try {
      const chooser = getDesktopApi().chooseProjectLibrary;
      if (!chooser) throw new Error('PROJECT_LIBRARY_CHOOSER_UNAVAILABLE');
      const library = await chooser();
      if (library) setLibraryStatus({ state: 'ready', library });
    } catch (cause) {
      const message = cause instanceof Error && cause.message === 'PROJECT_LIBRARY_DIRECTORY_NOT_EMPTY'
        ? t(locale, '所选目录不是空目录或项目库，请选择其他目录。', 'Choose an empty directory or an existing project library.')
        : t(locale, '无法选择项目库，请重试。', 'Could not choose the project library. Please retry.');
      setError(message);
    }
  };

  const workspace = libraryStatus.state === 'ready' ? toStudioWorkspace(libraryStatus.library) : null;
  const entered = workspace !== null;

  return (
    <main ref={appShellRef} className="app-shell" aria-label={copy.appName} data-theme={theme}>
      {!entered && <WindowBar copy={copy} locale={locale} theme={theme} nativeControlSide={nativeControlSide} onLocaleChange={changeLocale} onThemeChange={changeTheme} themeLabel={t(locale, '切换主题', 'Switch theme')} />}
      {entered ? (
        <Studio locale={locale} theme={theme} workspace={workspace} onLocaleChange={changeLocale} onThemeChange={changeTheme} />
      ) : (
        <section className="welcome" aria-labelledby="welcome-title">
          <p className="eyebrow">{copy.appName}</p>
          <h1 id="welcome-title">{copy.welcomeTitle}</h1>
          <p className="welcome-description">{copy.welcomeDescription}</p>
          <div className="welcome-actions">
            <button type="button" className="button button-primary" aria-label={t(locale, '选择项目库', 'Choose project library')} onClick={() => void chooseProjectLibrary()}>
              {t(locale, '选择项目库', 'Choose project library')}
            </button>
          </div>
          {(error || libraryStatus.state === 'needs-location') && <p role="status" className="inline-notice">{error || t(locale, '项目库位置不可用，请重新选择目录。', 'The project library is unavailable. Choose its location again.')}</p>}
        </section>
      )}
    </main>
  );
};

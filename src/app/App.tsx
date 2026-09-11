import { useEffect, useState } from 'react';

import { getMessages, type Locale } from './i18n';
import { WindowBar } from './shell/WindowBar';
import { Studio } from './studio/Studio';
import { Button, Field, Icon, Modal, t } from './studio/ui';
import type { Theme } from './studio/types';
import { getDesktopApi } from '../platform/desktop';
import './styles/tokens.css';
import './styles/window.css';

const readPreference = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const savePreference = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences remain usable in memory if local storage is unavailable. */
  }
};

const opensStudioOnLaunch = (): boolean =>
  new URLSearchParams(window.location.search).get('preview') === '1' ||
  (navigator.userAgent.includes('Electron/') && Boolean(window.designhub));

export const App = () => {
  const [locale, setLocale] = useState<Locale>(() =>
    readPreference('designhub.ui.locale') === 'en' ? 'en' : 'zh-CN',
  );
  const [theme, setTheme] = useState<Theme>(() => {
    const value = readPreference('designhub.ui.theme');
    return value === 'dark' || value === 'light' ? value : 'system';
  });
  const [entered, setEntered] = useState(opensStudioOnLaunch);
  const [workspaceForm, setWorkspaceForm] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [directory, setDirectory] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const changeLocale = (value: Locale) => {
    setLocale(value);
    savePreference('designhub.ui.locale', value);
  };
  const changeTheme = (value: Theme) => {
    setTheme(value);
    savePreference('designhub.ui.theme', value);
  };
  const copy = getMessages(locale);
  const nativeControlSide = navigator.userAgent.includes('Mac')
    ? 'left'
    : 'right';
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
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
    setWorkspaceError('');
    if (!window.designhub) {
      setWorkspaceError(
        t(
          locale,
          '请在桌面应用中选择本地目录。当前可以浏览示例工作区。',
          'Choose local folders in the desktop app. You can explore the example workspace here.',
        ),
      );
      return;
    }
    try {
      const path = await getDesktopApi().chooseWorkspaceDirectory();
      if (path) {
        setDirectory(path);
        setWorkspaceForm(true);
        setWorkspaceError(
          t(
            locale,
            '目录已选择，工作区读写能力尚未接入。',
            'Folder selected. Workspace storage is not connected yet.',
          ),
        );
      }
    } catch {
      setWorkspaceError(
        t(
          locale,
          '无法打开目录选择器，请重试。输入内容已保留。',
          'Could not open the folder chooser. Your input is preserved; please retry.',
        ),
      );
    }
  };

  return (
    <main className="app-shell" aria-label={copy.appName} data-theme={theme}>
      <WindowBar copy={copy} nativeControlSide={nativeControlSide} />
      {entered ? (
        <Studio
          locale={locale}
          theme={theme}
          onLocaleChange={changeLocale}
          onThemeChange={changeTheme}
          onExit={() => setEntered(false)}
        />
      ) : (
        <section className="welcome" aria-labelledby="welcome-title">
          <p className="eyebrow">{copy.appName}</p>
          <h1 id="welcome-title">{copy.welcomeTitle}</h1>
          <p className="welcome-description">{copy.welcomeDescription}</p>
          <div className="welcome-actions">
            <button
              type="button"
              className="button button-primary"
              aria-label={copy.newWorkspaceLabel}
              onClick={() => setWorkspaceForm(true)}
            >
              {copy.newWorkspace}
            </button>
            <button
              type="button"
              className="button button-secondary"
              aria-label={copy.openWorkspaceLabel}
              onClick={chooseWorkspaceDirectory}
            >
              {copy.openWorkspace}
            </button>
          </div>
          <button
            type="button"
            className="language-toggle"
            onClick={() => changeLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')}
            aria-label={locale === 'zh-CN' ? 'Switch to English' : '切换中文'}
          >
            {locale === 'zh-CN' ? 'EN' : '中文'}
          </button>
          <label className="theme-select-label">
            <span>{copy.themeLabel}</span>
            <select
              className="theme-select"
              value={theme}
              onChange={(event) => changeTheme(event.target.value as Theme)}
            >
              <option value="system">{copy.themeSystem}</option>
              <option value="dark">{copy.themeDark}</option>
              <option value="light">{copy.themeLight}</option>
            </select>
          </label>
          <div className="welcome-preview">
            <span className="welcome-preview-rule" />
            <p>
              {t(
                locale,
                '先看看 DesignHub 的创作空间',
                'Take a look around your creative workspace',
              )}
            </p>
            <Button
              icon="arrow-right"
              variant="ghost"
              onClick={() => setEntered(true)}
            >
              {t(locale, '浏览示例', 'Explore example')}
            </Button>
          </div>
          {workspaceError && !workspaceForm && (
            <p role="status" className="inline-notice">
              {workspaceError}
            </p>
          )}
        </section>
      )}
      {workspaceForm && (
        <Modal
          title={t(locale, '新建工作区', 'New workspace')}
          locale={locale}
          onClose={() => setWorkspaceForm(false)}
        >
          <p className="muted">
            {t(
              locale,
              '一个保存项目、设计师与素材的本地空间。',
              'A local home for your projects, designers and assets.',
            )}
          </p>
          <Field label={t(locale, '工作区名称', 'Workspace name')}>
            <input
              autoFocus
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder={t(
                locale,
                '例如：我的设计空间',
                'For example: My design studio',
              )}
            />
          </Field>
          <Field label={t(locale, '本地目录', 'Local folder')}>
            <input
              readOnly
              value={directory}
              placeholder={t(
                locale,
                '选择工作区保存位置',
                'Choose a workspace location',
              )}
            />
          </Field>
          <Button icon="folder-open" onClick={chooseWorkspaceDirectory}>
            {t(locale, '选择目录', 'Choose folder')}
          </Button>
          <p className="inline-notice">
            <Icon name="circle-help" size={16} />
            {workspaceError ||
              t(
                locale,
                '工作区存储尚未接入，可以先浏览示例体验完整界面。',
                'Workspace storage is not connected yet. Explore the example to preview the interface.',
              )}
          </p>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                setWorkspaceForm(false);
                setEntered(true);
              }}
            >
              {t(locale, '浏览示例', 'Explore example')}
            </Button>
            <Button variant="primary" disabled>
              {t(locale, '创建', 'Create workspace')}
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
};

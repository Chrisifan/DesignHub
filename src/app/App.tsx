import { useEffect, useRef, useState } from 'react';

import { getMessages, type Locale } from './i18n';
import { WindowBar } from './shell/WindowBar';
import { Studio } from './studio/Studio';
import { Button, Field, Icon, Modal, t } from './studio/ui';
import type { Theme } from './studio/types';
import type { WorkspaceDescriptor } from '../features/workspace/open-workspace';
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
  new URLSearchParams(window.location.search).get('preview') === '1';

const recentWorkspacesKey = 'designhub.recent.workspaces';
const isWorkspaceDescriptor = (value: unknown): value is WorkspaceDescriptor => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<WorkspaceDescriptor>;
  return typeof item.workspaceId === 'string' && item.workspaceId.length > 0
    && typeof item.name === 'string' && item.name.trim().length > 0
    && typeof item.directory === 'string' && item.directory.trim().length > 0
    && typeof item.formatVersion === 'number' && Number.isInteger(item.formatVersion) && item.formatVersion > 0
    && (item.openMode === 'writable' || item.openMode === 'read-only' || item.openMode === 'migration-required');
};
const readRecentWorkspaces = (): WorkspaceDescriptor[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(recentWorkspacesKey) ?? '');
    return Array.isArray(value) ? value.filter(isWorkspaceDescriptor).slice(0, 8) : [];
  } catch {
    return [];
  }
};

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
  const [workspace, setWorkspace] = useState<WorkspaceDescriptor | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceDescriptor[]>(readRecentWorkspaces);
  const startupRestoreAttempted = useRef(false);
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
  const rememberWorkspace = (next: WorkspaceDescriptor): void => {
    setRecentWorkspaces((current) => {
      const updated = [next, ...current.filter((entry) => entry.workspaceId !== next.workspaceId && entry.directory !== next.directory)].slice(0, 8);
      try { localStorage.setItem(recentWorkspacesKey, JSON.stringify(updated)); } catch { /* in-memory fallback */ }
      return updated;
    });
  };
  const applyWorkspace = (next: WorkspaceDescriptor): WorkspaceDescriptor => {
    setWorkspace(next);
    rememberWorkspace(next);
    setEntered(true);
    return next;
  };
  const openWorkspaceDirectory = async (path: string): Promise<WorkspaceDescriptor | null> => {
    setWorkspaceError('');
    const opener = getDesktopApi().openWorkspace;
    if (!opener) {
      setWorkspaceError(t(locale, '当前环境无法打开工作区。', 'Workspace opening is unavailable in this environment.'));
      return null;
    }
    try {
      const opened = await opener(path);
      if (!opened) {
        setWorkspaceError(t(locale, '无法打开工作区，请确认目录有效。', 'Could not open the workspace. Check that the folder is valid.'));
        return null;
      }
      return applyWorkspace(opened);
    } catch {
      setWorkspaceError(t(locale, '无法打开工作区，请确认目录有效。', 'Could not open the workspace. Check that the folder is valid.'));
      return null;
    }
  };
  useEffect(() => {
    if (entered || opensStudioOnLaunch() || startupRestoreAttempted.current || recentWorkspaces.length === 0 || !window.designhub?.openWorkspace) return;
    startupRestoreAttempted.current = true;
    void openWorkspaceDirectory(recentWorkspaces[0].directory);
  }, [entered, openWorkspaceDirectory, recentWorkspaces]);
  const chooseWorkspaceDirectory = async (purpose: 'create' | 'open' = 'create'): Promise<void> => {
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
    let path: string | null = null;
    try {
      path = await getDesktopApi().chooseWorkspaceDirectory();
    } catch {
      setWorkspaceError(
        t(
          locale,
          '无法打开目录选择器，请重试。输入内容已保留。',
          'Could not open the folder chooser. Your input is preserved; please retry.',
        ),
      );
      return;
    }
    if (!path) return;
    if (purpose === 'open') {
      await openWorkspaceDirectory(path);
      setWorkspaceForm(false);
      return;
    }
    setDirectory(path);
    setWorkspaceForm(true);
  };
  const createWorkspaceFromForm = async (): Promise<void> => {
    const name = workspaceName.trim();
    if (!name || !directory) return;
    setWorkspaceError('');
    try {
      const created = await getDesktopApi().createWorkspace?.({
        parentDirectory: directory,
        name,
      });
      if (!created) {
        setWorkspaceError(
          t(locale, '当前环境无法创建工作区。', 'Workspace creation is unavailable in this environment.'),
        );
        return;
      }
      applyWorkspace(created);
      setWorkspaceName('');
      setDirectory('');
      setWorkspaceForm(false);
      setEntered(true);
    } catch {
      setWorkspaceError(
        t(locale, '无法创建工作区，请检查名称和目录。', 'Could not create the workspace. Check the name and folder.'),
      );
    }
  };
  const canCreateWorkspace = Boolean(
    workspaceName.trim() && directory && getDesktopApi().createWorkspace,
  );

  return (
    <main className="app-shell" aria-label={copy.appName} data-theme={theme}>
      {!entered && (
        <WindowBar
          copy={copy}
          locale={locale}
          theme={theme}
          nativeControlSide={nativeControlSide}
          onLocaleChange={changeLocale}
          onThemeChange={changeTheme}
          themeLabel={t(locale, '切换主题', 'Switch theme')}
        />
      )}
      {entered ? (
        <Studio
          locale={locale}
          theme={theme}
          workspace={workspace}
          onLocaleChange={changeLocale}
          onThemeChange={changeTheme}
          onExit={() => setEntered(false)}
          recentWorkspaces={recentWorkspaces}
          onOpenWorkspace={openWorkspaceDirectory}
          onWorkspaceChange={applyWorkspace}
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
              onClick={() => {
                setWorkspaceError('');
                setWorkspaceForm(true);
              }}
            >
              {copy.newWorkspace}
            </button>
            <button
              type="button"
              className="button button-secondary"
              aria-label={copy.openWorkspaceLabel}
              onClick={() => chooseWorkspaceDirectory('open')}
            >
              {copy.openWorkspace}
            </button>
          </div>
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
          <Button icon="folder-open" onClick={() => chooseWorkspaceDirectory('create')}>
            {t(locale, '选择目录', 'Choose folder')}
          </Button>
          <p className="inline-notice">
            <Icon name="circle-help" size={16} />
            {workspaceError ||
              (getDesktopApi().createWorkspace
                ? t(locale, '选择父目录并填写名称后创建。', 'Choose a parent folder and name to create the workspace.')
                : t(locale, '工作区存储尚未接入，可以先浏览示例体验完整界面。', 'Workspace storage is not connected yet. Explore the example to preview the interface.'))}
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
            <Button
              variant="primary"
              disabled={!canCreateWorkspace}
              onClick={createWorkspaceFromForm}
            >
              {t(locale, '创建', 'Create workspace')}
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
};

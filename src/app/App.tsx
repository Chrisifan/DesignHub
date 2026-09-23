import { useEffect, useRef, useState } from 'react';

import { getMessages, type Locale } from './i18n';
import { WindowBar } from './shell/WindowBar';
import { ModelStep } from './onboarding/ModelStep';
import { ProfileStep } from './onboarding/ProfileStep';
import { Studio } from './studio/Studio';
import { t } from './studio/ui';
import type { Theme } from './studio/types';
import type { WorkspaceDescriptor } from '../features/workspace/open-workspace';
import type { ProjectLibraryDescriptor, ProjectLibraryStatus } from '../features/project-library/open-project-library';
import type { AppProfile } from '../features/profile/model';
import { getDesktopApi } from '../platform/desktop';
import type { ProfileAvatarInput } from '../platform/contracts';
import { usePointerDotBackground } from './usePointerDotBackground';
import './styles/tokens.css';
import './styles/window.css';

const splashDurationMs = 650;
type AppPhase = 'splash' | 'profile' | 'model' | 'library' | 'studio';

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
  const [phase, setPhase] = useState<AppPhase>('splash');
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [libraryStatus, setLibraryStatus] = useState<ProjectLibraryStatus>({ state: 'unselected' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const loadStartupState = async (): Promise<void> => {
      try {
        const api = getDesktopApi();
        const [loadedProfile, status] = await Promise.all([
          api.loadProfile?.() ?? Promise.resolve(null),
          api.getProjectLibraryStatus?.() ?? Promise.resolve({ state: 'unselected' as const }),
        ]);
        if (cancelled) return;
        setProfile(loadedProfile);
        if (status) setLibraryStatus(status);
        const nextPhase: AppPhase = !loadedProfile?.onboarding.profileCompleted
          ? 'profile'
          : !loadedProfile.onboarding.modelStepCompleted
            ? 'model'
            : status?.state === 'ready' ? 'studio' : 'library';
        const remaining = Math.max(0, splashDurationMs - (Date.now() - startedAt));
        revealTimer = setTimeout(() => {
          if (!cancelled) setPhase(nextPhase);
        }, remaining);
      } catch {
        if (cancelled) return;
        setError(t(locale, '无法读取启动配置，请重新设置。', 'Could not read startup configuration. Set it up again.'));
        revealTimer = setTimeout(() => {
          if (!cancelled) setPhase('profile');
        }, Math.max(0, splashDurationMs - (Date.now() - startedAt)));
      }
    };
    void loadStartupState();
    return () => {
      cancelled = true;
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, []);

  const chooseProjectLibrary = async (): Promise<ProjectLibraryDescriptor | null> => {
    setError('');
    try {
      const chooser = getDesktopApi().chooseProjectLibrary;
      if (!chooser) throw new Error('PROJECT_LIBRARY_CHOOSER_UNAVAILABLE');
      const library = await chooser();
      if (library) setLibraryStatus({ state: 'ready', library });
      return library;
    } catch (cause) {
      const message = cause instanceof Error && cause.message === 'PROJECT_LIBRARY_DIRECTORY_NOT_EMPTY'
        ? t(locale, '所选目录不是空目录或项目库，请选择其他目录。', 'Choose an empty directory or an existing project library.')
        : t(locale, '无法选择项目库，请重试。', 'Could not choose the project library. Please retry.');
      setError(message);
      throw cause;
    }
  };

  const submitProfile = async (input: { displayName: string; avatar: ProfileAvatarInput; library: ProjectLibraryDescriptor }): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const saved = await (getDesktopApi().saveProfile?.({
        displayName: input.displayName,
        avatar: input.avatar,
        onboarding: { profileCompleted: true },
      }) ?? null);
      if (!saved) throw new Error('PROFILE_SAVE_FAILED');
      setProfile(saved);
      setLibraryStatus({ state: 'ready', library: input.library });
      setPhase('model');
    } catch {
      setError(t(locale, '无法保存资料，请重试。', 'Could not save your profile. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const finishModelStep = async (): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const saved = await (getDesktopApi().saveProfile?.({ onboarding: { modelStepCompleted: true } }) ?? null);
      if (!saved) throw new Error('PROFILE_SAVE_FAILED');
      setProfile(saved);
      setPhase(libraryStatus.state === 'ready' ? 'studio' : 'library');
    } catch {
      setError(t(locale, '无法保存引导状态，请重试。', 'Could not save onboarding state. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const workspace = libraryStatus.state === 'ready' ? toStudioWorkspace(libraryStatus.library) : null;
  const entered = phase === 'studio' && workspace !== null;

  return (
    <main ref={appShellRef} className="app-shell" aria-label={copy.appName} data-theme={theme}>
      {phase !== 'splash' && !entered && <WindowBar copy={copy} locale={locale} theme={theme} nativeControlSide={nativeControlSide} onLocaleChange={changeLocale} onThemeChange={changeTheme} themeLabel={t(locale, '切换主题', 'Switch theme')} />}
      {phase === 'splash' ? (
        <section className="startup-splash" aria-label={copy.appName}>
          <picture>
            <img className="startup-splash__logo startup-splash__logo--light" src="./designhub-logo-light.png" alt={copy.appName} />
            <img className="startup-splash__logo startup-splash__logo--dark" src="./designhub-logo-dark.png" alt="" aria-hidden="true" />
          </picture>
          <strong>{copy.appName}</strong>
          <p>{t(locale, '无需登录，离线即可进入工作区。', 'Enter your workspace offline without signing in.')}</p>
        </section>
      ) : phase === 'profile' ? (
        <section className="onboarding-shell">
          <ProfileStep locale={locale} initialProfile={profile} onChooseProjectLibrary={chooseProjectLibrary} onSubmit={submitProfile} busy={busy} error={error} />
        </section>
      ) : phase === 'model' ? (
        <section className="onboarding-shell">
          <ModelStep locale={locale} onComplete={finishModelStep} onSkip={finishModelStep} />
        </section>
      ) : entered ? (
        <Studio locale={locale} theme={theme} workspace={workspace} profile={profile} onLocaleChange={changeLocale} onThemeChange={changeTheme} />
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

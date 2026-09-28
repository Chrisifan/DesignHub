import { useEffect, useRef, useState } from 'react';

import { getMessages, type Locale, type Messages } from './i18n';
import { WindowBar } from './shell/WindowBar';
import { ModelStep } from './onboarding/ModelStep';
import { ProfileStep } from './onboarding/ProfileStep';
import { Studio } from './studio/Studio';
import { t } from './studio/ui';
import type { Theme } from './studio/types';
import type { ProjectLibraryDescriptor, ProjectLibraryStatus } from '../features/project-library/open-project-library';
import type { AppProfile } from '../features/profile/model';
import { getDesktopApi } from '../platform/desktop';
import type { ProfileAvatarInput } from '../platform/contracts';
import { usePointerDotBackground } from './usePointerDotBackground';
import { createStartupProgressProfile, getVisualStartupProgress, type StartupCheck, type StartupCheckStatus, type StartupProgressProfile } from './startup-progress';
import './styles/tokens.css';
import './styles/window.css';

const splashDurationMs = 2200;
const splashCompletionHoldMs = 320;
const startupCheckIds = ['profile', 'library', 'workspace'] as const;
type AppPhase = 'splash' | 'profile' | 'model' | 'library' | 'studio';

const createStartupChecks = (): StartupCheck[] => startupCheckIds.map((id, index) => ({
  id,
  status: index === 0 ? 'active' : 'pending',
}));

const getStartupCheckLabels = (copy: Messages): Record<string, string> => ({
  profile: copy.splashCheckProfile,
  library: copy.splashCheckLibrary,
  workspace: copy.splashCheckWorkspace,
});

const readPreference = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const savePreference = (key: string, value: string): void => {
  try { localStorage.setItem(key, value); } catch { /* in-memory fallback */ }
};

export const App = () => {
  const [locale, setLocale] = useState<Locale>(() => readPreference('designhub.ui.locale') === 'en' ? 'en' : 'zh-CN');
  const [theme, setTheme] = useState<Theme>(() => {
    const value = readPreference('designhub.ui.theme');
    return value === 'dark' || value === 'light' ? value : 'system';
  });
  const [phase, setPhase] = useState<AppPhase>('splash');
  const [startupChecks, setStartupChecks] = useState<StartupCheck[]>(createStartupChecks);
  const [startupElapsedMs, setStartupElapsedMs] = useState(0);
  const [startupProgressProfile] = useState<StartupProgressProfile>(() => createStartupProgressProfile());
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
  const updateStartupCheck = (id: string, status: StartupCheckStatus): void => {
    setStartupChecks((current) => current.map((check) => check.id === id ? { ...check, status } : check));
  };

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);

  useEffect(() => {
    if (phase !== 'splash') return;
    const startedAt = Date.now();
    const progressTimer = setInterval(() => {
      setStartupElapsedMs(Date.now() - startedAt);
    }, 50);
    return () => clearInterval(progressTimer);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    let completeTimer: ReturnType<typeof setTimeout> | undefined;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const loadStartupState = async (): Promise<void> => {
      let activeCheckId = 'profile';
      try {
        const api = getDesktopApi();
        const loadedProfile = await (api.loadProfile?.() ?? Promise.resolve(null));
        if (cancelled) return;
        setProfile(loadedProfile);
        updateStartupCheck('profile', 'complete');
        activeCheckId = 'library';
        updateStartupCheck(activeCheckId, 'active');
        const status = await (api.getProjectLibraryStatus?.() ?? Promise.resolve({ state: 'unselected' as const }));
        if (cancelled) return;
        if (status) setLibraryStatus(status);
        updateStartupCheck('library', 'complete');
        activeCheckId = 'workspace';
        updateStartupCheck(activeCheckId, 'active');
        const nextPhase: AppPhase = !loadedProfile?.onboarding.profileCompleted
          ? 'profile'
          : !loadedProfile.onboarding.modelStepCompleted
            ? 'model'
            : status?.state === 'ready' ? 'studio' : 'library';
        const remaining = Math.max(0, splashDurationMs + splashCompletionHoldMs - (Date.now() - startedAt));
        const completeRemaining = Math.max(0, splashDurationMs - (Date.now() - startedAt));
        completeTimer = setTimeout(() => {
          if (!cancelled) updateStartupCheck('workspace', 'complete');
        }, completeRemaining);
        revealTimer = setTimeout(() => {
          if (cancelled) return;
          setPhase(nextPhase);
        }, remaining);
      } catch {
        if (cancelled) return;
        updateStartupCheck(activeCheckId, 'error');
        setError(t(locale, '无法读取启动配置，请重新设置。', 'Could not read startup configuration. Set it up again.'));
        revealTimer = setTimeout(() => {
          if (!cancelled) setPhase('profile');
        }, Math.max(0, splashDurationMs + splashCompletionHoldMs - (Date.now() - startedAt)));
      }
    };
    void loadStartupState();
    return () => {
      cancelled = true;
      if (completeTimer) clearTimeout(completeTimer);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, []);

  const chooseProjectLibrary = async (): Promise<ProjectLibraryDescriptor | null> => {
    setError('');
    try {
      const chooser = getDesktopApi().chooseProjectLibrary;
      if (!chooser) throw new Error('PROJECT_LIBRARY_CHOOSER_UNAVAILABLE');
      const library = await chooser();
      if (library) {
        setLibraryStatus({ state: 'ready', library });
        if (phase === 'library') setPhase('studio');
      }
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

  const library = libraryStatus.state === 'ready' ? libraryStatus.library : null;
  const entered = phase === 'studio' && library !== null;
  const startupProgress = getVisualStartupProgress(startupElapsedMs, splashDurationMs, startupProgressProfile);
  const startupCheckLabels = getStartupCheckLabels(copy);
  const activeStartupCheck = startupChecks.find((check) => check.status === 'active');
  const activeStartupLabel = activeStartupCheck
    ? startupCheckLabels[activeStartupCheck.id]
    : startupProgress >= 100 ? copy.splashReadyLabel : copy.splashProgressLabel;

  return (
    <main ref={appShellRef} className="app-shell" aria-label={copy.appName} data-theme={theme}>
      {phase !== 'splash' && !entered && <WindowBar copy={copy} locale={locale} theme={theme} nativeControlSide={nativeControlSide} onLocaleChange={changeLocale} onThemeChange={changeTheme} themeLabel={t(locale, '切换主题', 'Switch theme')} />}
      {phase === 'splash' ? (
        <section className="startup-splash" aria-label={copy.appName}>
          <div className="startup-splash__topline">
            <span className="startup-splash__system-mark">DESIGNHUB / BOOT SEQUENCE</span>
            <span className="startup-splash__system-state">LOCAL FIRST</span>
          </div>
          <div className="startup-splash__frame">
            <div className="startup-splash__brand">
              <picture>
                <img className="startup-splash__logo startup-splash__logo--light" src="./designhub-splash-logo-light.png" alt={copy.appName} />
                <img className="startup-splash__logo startup-splash__logo--dark" src="./designhub-splash-logo-dark.png" alt="" aria-hidden="true" />
              </picture>
              <div>
                <strong>{copy.appName}</strong>
                <p>{copy.splashSlogan}</p>
              </div>
            </div>
            <div className="startup-splash__progress-panel" aria-label={copy.splashProgressLabel}>
              <div className="startup-splash__progress-heading">
                <span className="startup-splash__status-dot" aria-hidden="true" />
                <span>{activeStartupLabel}</span>
                <strong>{startupProgress}% COMPLETED</strong>
              </div>
              <div
                className="startup-splash__progress-track"
                role="progressbar"
                aria-label={copy.splashProgressLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={startupProgress}
                aria-valuetext={`${activeStartupLabel} ${startupProgress}%`}
              >
                <span style={{ width: `${startupProgress}%` }} />
              </div>
              <div className="startup-splash__check-list" aria-label={copy.splashChecksLabel}>
                {startupChecks.map((check) => (
                  <span className={`startup-splash__check startup-splash__check--${check.status}`} key={check.id}>
                    <span className="startup-splash__check-dot" aria-hidden="true" />
                    <span>{startupCheckLabels[check.id]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="startup-splash__footer">
            <span>▣ LOCAL FIRST ENCLAVE · AES-256 ISOLATED</span>
            <span>LATENCY: 0.1ms · READY</span>
          </div>
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
        <Studio locale={locale} theme={theme} library={library} profile={profile} onLocaleChange={changeLocale} onThemeChange={changeTheme} />
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

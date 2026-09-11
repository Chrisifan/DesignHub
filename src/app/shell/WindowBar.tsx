import type { Locale, Messages } from '../i18n';
import type { Theme } from '../studio/types';
import { Icon, IconButton } from '../studio/ui';

type WindowBarProps = {
  copy: Messages;
  locale: Locale;
  theme: Theme;
  nativeControlSide: 'left' | 'right';
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: Theme) => void;
  previewLabel?: string;
  themeLabel: string;
  workspace?: {
    name: string;
    detail: string;
    label: string;
    onClick: () => void;
  };
};

export const WindowBar = ({
  copy,
  locale,
  theme,
  nativeControlSide,
  onLocaleChange,
  onThemeChange,
  previewLabel,
  themeLabel,
  workspace,
}: WindowBarProps) => (
  <header className="window-bar">
    {nativeControlSide === 'left' ? <div className="window-control-safe-area window-control-safe-area--left" aria-hidden="true" /> : null}
    <div className="window-bar-drag-region">
      <div className="window-brand">
        <span className="window-brand-mark" aria-hidden="true">
          D
        </span>
        <span className="window-bar-title">{copy.appName}</span>
      </div>
      {workspace ? (
        <>
          <span className="window-bar-separator" aria-hidden="true" />
          <button
            type="button"
            className="window-workspace-switch"
            onClick={workspace.onClick}
            title={workspace.label}
            aria-label={workspace.label}
          >
            <span className="window-workspace-name">
              <strong>{workspace.name}</strong>
              <small>· {workspace.detail}</small>
            </span>
            <Icon name="chevron-down" size={14} />
          </button>
        </>
      ) : null}
      <div className="window-bar-actions">
        {previewLabel ? (
          <span className="window-preview-label">
            <span aria-hidden="true" />
            {previewLabel}
          </span>
        ) : null}
        <IconButton
          name={theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor'}
          label={themeLabel}
          onClick={() =>
            onThemeChange(
              theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system',
            )
          }
        />
        <button
          type="button"
          className="window-locale-switch"
          aria-label={locale === 'zh-CN' ? 'Switch to English' : '切换中文'}
          onClick={() => onLocaleChange(locale === 'zh-CN' ? 'en' : 'zh-CN')}
        >
          {locale === 'zh-CN' ? 'EN' : '中'}
        </button>
      </div>
    </div>
    {nativeControlSide === 'right' ? <div className="window-control-safe-area window-control-safe-area--right" aria-hidden="true" /> : null}
  </header>
);

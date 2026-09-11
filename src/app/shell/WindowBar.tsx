import type { Messages } from '../i18n';
import { Icon } from '../studio/ui';

type WindowBarProps = {
  copy: Messages;
  nativeControlSide: 'left' | 'right';
  workspace?: {
    name: string;
    detail: string;
    label: string;
    onClick: () => void;
  };
};

export const WindowBar = ({
  copy,
  nativeControlSide,
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
            <span>
              <strong>{workspace.name}</strong>
              <small>{workspace.detail}</small>
            </span>
            <Icon name="chevron-down" size={14} />
          </button>
        </>
      ) : null}
    </div>
    {nativeControlSide === 'right' ? <div className="window-control-safe-area window-control-safe-area--right" aria-hidden="true" /> : null}
  </header>
);

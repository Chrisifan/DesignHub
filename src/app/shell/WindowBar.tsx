import type { Messages } from '../i18n';

type WindowBarProps = {
  copy: Messages;
  nativeControlSide: 'left' | 'right';
};

export const WindowBar = ({ copy, nativeControlSide }: WindowBarProps) => (
  <header className="window-bar">
    {nativeControlSide === 'left' ? <div className="window-control-safe-area window-control-safe-area--left" aria-hidden="true" /> : null}
    <div className="window-bar-drag-region" aria-hidden="true">
      <span className="window-bar-title">{copy.appName}</span>
    </div>
    {nativeControlSide === 'right' ? <div className="window-control-safe-area window-control-safe-area--right" aria-hidden="true" /> : null}
  </header>
);

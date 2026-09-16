import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { Locale } from '../i18n';
import { IconButton, t } from './ui';

const focusableSelector = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export type DrawerProps = {
  open: boolean;
  title: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  locale?: Locale;
};

export const Drawer = ({
  open,
  title,
  className = '',
  onClose,
  children,
  footer,
  locale = 'zh-CN',
}: DrawerProps) => {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() => (
    document.querySelector<HTMLElement>('[data-drawer-host]') ?? document.body
  ));

  useEffect(() => {
    if (!open) {
      const returnFocus = returnFocusRef.current;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      return undefined;
    }

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const nextTarget = document.querySelector<HTMLElement>('[data-drawer-host]') ?? document.body;
    setPortalTarget((currentTarget) => currentTarget === nextTarget ? currentTarget : nextTarget);
  }, [open, portalTarget]);

  if (!open) return null;
  if (!portalTarget) return null;

  return createPortal(
    <div className="ui-drawer-root">
      <button
        type="button"
        className="ui-drawer__backdrop"
        data-testid="drawer-backdrop"
        aria-label={t(locale, '关闭抽屉', 'Close drawer')}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className={`ui-drawer ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ui-drawer__heading">
          <h2 id={titleId}>{title}</h2>
          <IconButton name="x" label={t(locale, '关闭', 'Close')} onClick={onClose} />
        </header>
        <div className="ui-drawer__content">{children}</div>
        {footer ? <div className="ui-drawer__footer">{footer}</div> : null}
      </aside>
    </div>,
    portalTarget,
  );
};

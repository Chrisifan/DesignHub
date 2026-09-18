import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import type { Locale } from '../i18n';
import type { Artwork } from './types';
import { Tooltip } from './Tooltip';

export const t = (locale: Locale, zh: string, en: string): string =>
  locale === 'zh-CN' ? zh : en;
export const Icon = ({ name, size = 18 }: { name: string; size?: number }) => (
  <span
    aria-hidden="true"
    className="ui-icon"
    style={{
      width: size,
      height: size,
      maskImage: `url(./icons/${name}.svg)`,
      WebkitMaskImage: `url(./icons/${name}.svg)`,
    }}
  />
);
export const Button = ({
  children,
  icon,
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'ai';
}) => (
  <button
    type="button"
    className={`ui-button ui-button--${variant} ${className}`}
    {...props}
  >
    {icon && <Icon name={icon} size={16} />}
    {children}
  </button>
);
export const IconButton = ({
  name,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  name: string;
  label: string;
}) => (
  <Tooltip content={label} asChild>
    <button
      type="button"
      className="icon-button"
      title={label}
      data-tooltip={label}
      data-tooltip-portal="true"
      aria-label={label}
      {...props}
    >
      <Icon name={name} />
    </button>
  </Tooltip>
);
export const Badge = ({
  children,
  tone = '',
}: {
  children: ReactNode;
  tone?: string;
}) => <span className={`badge ${tone && `badge--${tone}`}`}>{children}</span>;
export const Field = ({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: string;
}) => (
  <label className="ui-field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
);

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export const Select = ({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  className = '',
}: {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const choose = (option: SelectOption): void => {
    if (option.disabled) return;
    onChange(option.value);
    setActiveIndex(Math.max(0, options.findIndex((entry) => entry.value === option.value)));
    setOpen(false);
  };
  const move = (direction: 1 | -1): void => {
    const start = activeIndex;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (start + direction * offset + options.length) % options.length;
      if (!options[index]?.disabled) {
        setActiveIndex(index);
        return;
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className={`ui-select ${open ? 'is-open' : ''} ${className}`}
    >
      <input
        type="text"
        className="ui-select__trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-valuetext={selected ? String(selected.label) : value}
        value={value}
        readOnly
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        onChange={(event) => {
          const next = (event.target as HTMLButtonElement).value;
          if (next !== value && options.some((option) => option.value === next)) onChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
              setOpen(true);
            } else move(event.key === 'ArrowDown' ? 1 : -1);
          }
          if (event.key === 'Enter' && open) {
            event.preventDefault();
            const option = options[activeIndex];
            if (option) choose(option);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
            setOpen(true);
          }
        }}
      />
      <span className="ui-select__value" aria-hidden="true">{selected?.label}</span>
      <Icon name="chevron-down" size={15} />
      <div className={`ui-select__menu ${open ? '' : 'is-closed'}`} role="listbox">
        {options.map((option) => (
          <button
            type="button"
            role="option"
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            className={`${option.value === value ? 'is-selected' : ''} ${options[activeIndex]?.value === option.value ? 'is-active' : ''}`}
            key={option.value}
            disabled={option.disabled}
            onClick={() => choose(option)}
          >
            <span>{option.label}</span>
            {option.value === value && <Icon name="check" size={14} />}
          </button>
        ))}
      </div>
    </div>
  );
};
export const PageHeader = ({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) => (
  <header className="page-heading">
    <div className="page-heading__content">
      {eyebrow && <p className="section-kicker">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  </header>
);
export const EmptyState = ({
  icon = 'folder-open',
  title,
  description,
  children,
}: {
  icon?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) => (
  <div className="empty-state">
    <span className="empty-state-icon">
      <Icon name={icon} size={28} />
    </span>
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {children}
  </div>
);
export const Modal = ({
  title,
  children,
  onClose,
  locale,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  locale: Locale;
  wide?: boolean;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog
      .querySelector<HTMLElement>(
        'input:not([type=hidden]):not(:disabled), textarea:not(:disabled)',
      )
      ?.focus({ preventScroll: true });
    return () => {
      if (typeof dialog.close === 'function') dialog.close();
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`ui-dialog ${wide ? 'ui-dialog--wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <IconButton
          name="x"
          label={t(locale, '关闭', 'Close')}
          onClick={onClose}
        />
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
};
export const ArtworkPreview = ({
  kind = 'market',
  className = '',
}: {
  kind?: Artwork;
  className?: string;
}) => (
  <div className={`artwork artwork--${kind} ${className}`} aria-hidden="true">
    {kind === 'market' ? (
      <>
        <span className="art-meta">FIELD NOTES — NO. 026</span>
        <span className="art-flower">
          <i />
          <i />
          <i />
          <i />
          <b />
        </span>
        <div className="art-title">
          春间
          <br />
          市集
          <span>
            SPRING
            <br />
            IN BLOOM.
          </span>
        </div>
        <span className="art-bottom">
          城市生活的另一种可能
          <br />
          <b>04.18 — 04.20　/　2026</b>
        </span>
      </>
    ) : kind === 'objects' ? (
      <>
        <span className="art-meta">EVERYDAY OBJECTS</span>
        <div className="art-object">
          <i />
          <b />
        </div>
        <div className="art-object-title">
          少即是多。<small>LESS, BUT BETTER.</small>
        </div>
        <span className="art-bottom">FORM / FUNCTION / FEELING</span>
      </>
    ) : kind === 'type' ? (
      <>
        <span className="art-meta">AN INDEPENDENT DESIGN JOURNAL</span>
        <div className="art-type-title">
          TYPE
          <br />
          <em>&</em>FORM
        </div>
        <span className="art-bottom">
          形与字之间。
          <br />
          VOL. 03 — 2026
        </span>
      </>
    ) : (
      <div className="art-blank">
        <Icon name="file-image" size={36} />
        <span>DESIGN DOCUMENT</span>
      </div>
    )}
  </div>
);

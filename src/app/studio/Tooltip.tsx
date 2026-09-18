import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
};

type TooltipPosition = {
  left: number;
  top: number;
};

export const Tooltip = ({ content, children, className = '' }: TooltipProps) => {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const show = () => {
    setPosition(null);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!trigger || !tooltip) return;
      const margin = 8;
      const gap = 8;
      const left = Math.min(
        window.innerWidth - tooltip.width - margin,
        Math.max(margin, trigger.left + trigger.width / 2 - tooltip.width / 2),
      );
      const below = trigger.bottom + gap;
      const top = below + tooltip.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, trigger.top - tooltip.height - gap);
      setPosition({ left, top });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return <>
    <span
      ref={triggerRef}
      className={`ui-tooltip-trigger ${className}`}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }}
    >{children}</span>
    {open && createPortal(
      <span
        ref={tooltipRef}
        id={id}
        role="tooltip"
        className="ui-tooltip"
        style={{
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position ? 'visible' : 'hidden',
        }}
      >{content}</span>,
      document.body,
    )}
  </>;
};

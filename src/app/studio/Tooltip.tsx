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
    const tooltip = tooltipRef.current;
    if (!tooltip) return undefined;
    if (typeof tooltip.showPopover === 'function' && !tooltip.matches(':popover-open')) {
      tooltip.showPopover();
    }
    const update = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tooltipBounds = tooltip.getBoundingClientRect();
      if (!trigger) return;
      const margin = 8;
      const gap = 8;
      const left = Math.min(
        window.innerWidth - tooltipBounds.width - margin,
        Math.max(margin, trigger.left + trigger.width / 2 - tooltipBounds.width / 2),
      );
      const below = trigger.bottom + gap;
      const top = below + tooltipBounds.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, trigger.top - tooltipBounds.height - gap);
      setPosition({ left, top });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      if (typeof tooltip.hidePopover === 'function' && tooltip.matches(':popover-open')) {
        tooltip.hidePopover();
      }
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
        popover="manual"
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

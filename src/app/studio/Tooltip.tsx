import { cloneElement, isValidElement, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  asChild?: boolean;
  placement?: TooltipPlacement;
};

export type TooltipPlacement = 'auto' | 'top' | 'right' | 'bottom' | 'left';

type TooltipPosition = {
  left: number;
  top: number;
};

let activeTooltipDismiss: (() => void) | null = null;

export const Tooltip = ({ content, children, className = '', asChild = false, placement = 'auto' }: TooltipProps) => {
  const id = useId();
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const hide = (): void => {
    setOpen(false);
    if (activeTooltipDismiss === hide) activeTooltipDismiss = null;
  };
  const show = () => {
    activeTooltipDismiss?.();
    setPosition(null);
    setOpen(true);
    activeTooltipDismiss = hide;
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
      const centeredTop = Math.min(
        window.innerHeight - tooltipBounds.height - margin,
        Math.max(margin, trigger.top + trigger.height / 2 - tooltipBounds.height / 2),
      );
      const centeredLeft = Math.min(
        window.innerWidth - tooltipBounds.width - margin,
        Math.max(margin, trigger.left + trigger.width / 2 - tooltipBounds.width / 2),
      );
      let left = centeredLeft;
      let top = centeredTop;
      if (placement === 'right') {
        left = Math.min(window.innerWidth - tooltipBounds.width - margin, trigger.right + gap);
      } else if (placement === 'left') {
        left = Math.max(margin, trigger.left - tooltipBounds.width - gap);
      } else if (placement === 'top') {
        top = Math.max(margin, trigger.top - tooltipBounds.height - gap);
      } else if (placement === 'bottom') {
        top = Math.min(window.innerHeight - tooltipBounds.height - margin, trigger.bottom + gap);
      } else {
        const above = trigger.top - tooltipBounds.height - gap;
        top = above >= margin ? above : Math.min(window.innerHeight - tooltipBounds.height - margin, trigger.bottom + gap);
      }
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
      if (activeTooltipDismiss === hide) activeTooltipDismiss = null;
    };
  }, [open]);

  const dismissOnEscape = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    hide();
  };
  const childElement = asChild && isValidElement(children)
    ? children as ReactElement<Record<string, unknown>>
    : null;
  const childClassName = typeof childElement?.props.className === 'string' ? childElement.props.className : '';
  const trigger = childElement
    ? cloneElement(childElement, {
        ref: triggerRef,
        className: `${childClassName} ui-tooltip-trigger ${className}`.trim(),
        'aria-describedby': open ? id : undefined,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
        onKeyDown: dismissOnEscape,
      })
    : (
      <span
        ref={triggerRef}
        className={`ui-tooltip-trigger ${className}`}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={dismissOnEscape}
    >{children}</span>
    );

  return <>
    {trigger}
    {open && createPortal(
      <span
        ref={tooltipRef}
        id={id}
        role="tooltip"
        popover="manual"
        className={`ui-tooltip ${placement !== 'auto' ? `ui-tooltip--${placement}` : ''}`.trim()}
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

import { useEffect, type RefObject } from 'react';

export const usePointerDotBackground = (rootRef: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const root = rootRef.current;
    const reducedMotion = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    if (!root || reducedMotion?.matches) return undefined;

    let frameId: number | null = null;
    let clientX = 0;
    let clientY = 0;
    const flush = (): void => {
      frameId = null;
      const bounds = root.getBoundingClientRect();
      root.style.setProperty('--pointer-x', `${clientX - bounds.left}px`);
      root.style.setProperty('--pointer-y', `${clientY - bounds.top}px`);
      root.dataset.pointerActive = 'true';
    };
    const onPointerMove = (event: PointerEvent): void => {
      clientX = event.clientX;
      clientY = event.clientY;
      if (frameId === null) frameId = window.requestAnimationFrame(flush);
    };
    const onPointerLeave = (): void => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      delete root.dataset.pointerActive;
    };

    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerleave', onPointerLeave);
    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      delete root.dataset.pointerActive;
    };
  }, [rootRef]);
};

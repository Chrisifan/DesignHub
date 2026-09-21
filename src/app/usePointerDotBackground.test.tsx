import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { usePointerDotBackground } from './usePointerDotBackground';

const Harness = () => {
  const ref = useRef<HTMLElement>(null);
  usePointerDotBackground(ref);
  return <main ref={ref}>workspace</main>;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('coalesces pointer movement into one animation-frame update and clears on leave', () => {
  let frame: FrameRequestCallback | undefined;
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  const cancelAnimationFrame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  const { getByRole } = render(<Harness />);
  const shell = getByRole('main');
  vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
    left: 10,
    top: 20,
    width: 500,
    height: 400,
    right: 510,
    bottom: 420,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  });

  fireEvent.pointerMove(shell, { clientX: 110, clientY: 170 });
  fireEvent.pointerMove(shell, { clientX: 130, clientY: 190 });
  expect(requestAnimationFrame).toHaveBeenCalledOnce();
  frame?.(0);
  expect(shell.style.getPropertyValue('--pointer-x')).toBe('120px');
  expect(shell.style.getPropertyValue('--pointer-y')).toBe('170px');
  expect(shell).toHaveAttribute('data-pointer-active', 'true');

  fireEvent.pointerLeave(shell);
  expect(shell).not.toHaveAttribute('data-pointer-active');
});

it('does not follow the pointer when reduced motion is requested', () => {
  const requestAnimationFrame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  const { getByRole } = render(<Harness />);

  fireEvent.pointerMove(getByRole('main'), { clientX: 40, clientY: 60 });

  expect(requestAnimationFrame).not.toHaveBeenCalled();
});

export type TextInputState = {
  composing: boolean;
  key: string;
};

export const shouldCommitText = (input: TextInputState): boolean => !input.composing && input.key === 'Enter';

export const shouldHandleCanvasShortcut = (input: TextInputState): boolean => !input.composing && ['Delete', 'Backspace', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(input.key);

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { TextEditor } from './TextEditor';

const layer = {
  id: 'text-1', type: 'text' as const, text: '春间', fontFamily: 'Noto Sans CJK', fontSize: 48,
  fontWeight: '600', align: 'left' as const, color: '#111111', x: 0, y: 0, width: 480, height: 120,
  rotation: 0, opacity: 1, visible: true, locked: false,
};

it('edits mixed-language multiline text without committing composing Enter', () => {
  const onChange = vi.fn();
  render(<TextEditor locale="zh-CN" layer={layer} availableFonts={['Noto Sans CJK']} onChange={onChange} />);
  const editor = screen.getByRole('textbox', { name: '文本内容' });
  fireEvent.change(editor, { target: { value: '春间\nSpring Market' } });
  fireEvent.keyDown(editor, { key: 'Enter', isComposing: true });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: '春间\nSpring Market' }));
});

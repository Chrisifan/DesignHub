import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ProjectCoverPicker } from './ProjectCoverPicker';
import type { ProjectCoverDraft } from './types';

const createObjectURL = vi.fn(() => 'blob:cover-1');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('starts with the default cover and accepts a valid replacement', async () => {
  const onChange = vi.fn();
  render(<ProjectCoverPicker locale="zh-CN" value={undefined} onChange={onChange} />);

  expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', '/project-default-cover.png');
  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })] },
  });

  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    name: 'cover.png',
    mimeType: 'image/png',
    previewUrl: 'blob:cover-1',
    bytes: new Uint8Array([1]),
  })));
});

it('rejects an unsupported image without replacing the current cover', async () => {
  const onChange = vi.fn();
  render(<ProjectCoverPicker locale="zh-CN" value={undefined} onChange={onChange} />);

  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File(['svg'], 'cover.svg', { type: 'image/svg+xml' })] },
  });

  expect(await screen.findByRole('alert')).toHaveTextContent('PNG、JPEG 或 WebP');
  expect(onChange).not.toHaveBeenCalled();
});

it('restores the default cover and releases the previous preview URL', () => {
  const onChange = vi.fn();
  const value: ProjectCoverDraft = {
    name: 'cover.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([1]),
    previewUrl: 'blob:previous-cover',
  };
  render(<ProjectCoverPicker locale="zh-CN" value={value} onChange={onChange} />);

  fireEvent.click(screen.getByRole('button', { name: '恢复默认封面' }));

  expect(revokeObjectURL).toHaveBeenCalledWith('blob:previous-cover');
  expect(onChange).toHaveBeenCalledWith(undefined);
});

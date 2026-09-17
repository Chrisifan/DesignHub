import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { PortfolioUploader } from './PortfolioUploader';

const file = (name: string, type: string, size = 4, bytes = new Uint8Array([137, 80, 78, 71])) => ({
  name,
  type,
  size,
  arrayBuffer: async () => bytes.buffer,
}) as File;

it('opens the unified native picker when clicked', () => {
  const onInspect = vi.fn();
  render(<PortfolioUploader locale="en" busy={false} onInspect={onInspect} onError={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Upload portfolio files' }));

  expect(onInspect).toHaveBeenCalledWith({ kind: 'local-files' });
});

it('reads pasted files into an uploaded-files request', async () => {
  const onInspect = vi.fn();
  const pasted = file('pasted.png', 'image/png');
  render(<PortfolioUploader locale="en" busy={false} onInspect={onInspect} onError={vi.fn()} />);

  fireEvent.paste(screen.getByRole('button', { name: 'Upload portfolio files' }), { clipboardData: { files: [pasted] } });

  await waitFor(() => expect(onInspect).toHaveBeenCalledWith({
    kind: 'uploaded-files',
    files: [{ name: 'pasted.png', mimeType: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) }],
  }));
});

it('rejects nine dropped images without inspecting them', async () => {
  const onInspect = vi.fn();
  const onError = vi.fn();
  render(<PortfolioUploader locale="en" busy={false} onInspect={onInspect} onError={onError} />);

  fireEvent.drop(screen.getByRole('button', { name: 'Upload portfolio files' }), {
    dataTransfer: { files: Array.from({ length: 9 }, (_, index) => file(`sheet-${index}.png`, 'image/png')) },
  });

  await waitFor(() => expect(onError).toHaveBeenCalledWith('Upload at most 8 images.'));
  expect(onInspect).not.toHaveBeenCalled();
});

it.each([
  {
    name: 'a mixed image and ZIP batch',
    files: [file('cover.png', 'image/png'), file('references.zip', 'application/zip')],
    message: 'Upload images or one ZIP, not both.',
  },
  {
    name: 'multiple ZIP archives',
    files: [file('first.zip', 'application/zip'), file('second.zip', 'application/zip')],
    message: 'Upload only one ZIP archive.',
  },
  {
    name: 'unsupported file extensions',
    files: [file('notes.pdf', 'application/pdf')],
    message: 'Use PNG, JPEG, WebP, GIF, or ZIP files.',
  },
  {
    name: 'an image over its byte limit',
    files: [file('large.png', 'image/png', 8 * 1024 * 1024 + 1)],
    message: 'Each image must be 8 MiB or smaller.',
  },
  {
    name: 'a ZIP over its byte limit',
    files: [file('large.zip', 'application/zip', 24 * 1024 * 1024 + 1)],
    message: 'The ZIP archive must be 24 MiB or smaller.',
  },
])('rejects $name', async ({ files, message }) => {
  const onInspect = vi.fn();
  const onError = vi.fn();
  render(<PortfolioUploader locale="en" busy={false} onInspect={onInspect} onError={onError} />);

  fireEvent.drop(screen.getByRole('button', { name: 'Upload portfolio files' }), { dataTransfer: { files } });

  await waitFor(() => expect(onError).toHaveBeenCalledWith(message));
  expect(onInspect).not.toHaveBeenCalled();
});

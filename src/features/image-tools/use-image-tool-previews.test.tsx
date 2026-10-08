import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import type { ImageToolItem, ImageToolJob } from './jobs';
import { useImageToolPreviews } from './use-image-tool-previews';

const job = {
  id: 'job-preview',
  tool: 'upscale',
  params: { scale: 2, preserveDetails: 'balanced' },
  sourceRoot: '/source',
  outputRoot: '/output',
  state: 'completed',
  itemIds: ['item-preview'],
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
} satisfies ImageToolJob;

const item = {
  id: 'item-preview',
  jobId: job.id,
  relativePath: 'hero.png',
  state: 'completed',
  attempt: 1,
  resultPath: '/output/hero.png',
  updatedAt: '2026-10-05T00:00:00.000Z',
} satisfies ImageToolItem;

const PreviewProbe = ({
  jobs,
  onReadResult,
}: {
  jobs: ReadonlyArray<{ job: ImageToolJob; items: ImageToolItem[] }>;
  onReadResult?: (path: string, jobId: string) => Promise<string | null>;
}) => {
  const previews = useImageToolPreviews(jobs, onReadResult);
  return <output data-testid="preview-value">{previews['job-preview:item-preview'] ?? ''}</output>;
};

it('loads each result once and exposes the data URL by job/item key', async () => {
  const readResult = vi.fn(async () => 'data:image/png;base64,preview');
  const jobs = [{ job, items: [item] }];

  render(<PreviewProbe jobs={jobs} onReadResult={readResult} />);

  await waitFor(() => expect(screen.getByTestId('preview-value')).toHaveTextContent('data:image/png;base64,preview'));
  expect(readResult).toHaveBeenCalledOnce();
  expect(readResult).toHaveBeenCalledWith('/output/hero.png', 'job-preview');
});

it('does not update state after an in-flight reader is unmounted', async () => {
  const noop = (value: string): void => { void value; };
  let resolveResult: (value: string) => void = noop;
  const readResult = vi.fn(() => new Promise<string>((resolve) => {
    resolveResult = resolve;
  }));
  const view = render(<PreviewProbe jobs={[{ job, items: [item] }]} onReadResult={readResult} />);
  view.unmount();
  resolveResult('data:image/png;base64 late');
  await Promise.resolve();
  expect(readResult).toHaveBeenCalledOnce();
});

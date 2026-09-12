import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { AssetLibrary } from './AssetLibrary';

it('renders managed asset metadata and external reference state', () => {
  render(<AssetLibrary assets={[{
    id: 'asset-1',
    name: 'poster.png',
    format: 'PNG',
    mimeType: 'image/png',
    contentHash: 'hash-1',
    decode: { width: 1080, height: 1440 },
    managed: true,
  }, {
    id: 'asset-2',
    name: 'remote.svg',
    format: 'SVG',
    mimeType: 'image/svg+xml',
    contentHash: 'hash-2',
    managed: false,
    externalReference: 'https://example.com/remote.svg',
  }]} />);

  expect(screen.getByRole('region', { name: 'Asset library' })).toBeInTheDocument();
  expect(screen.getByText('poster.png')).toBeInTheDocument();
  expect(screen.getByText(/PNG.*1080.*1440/)).toBeInTheDocument();
  expect(screen.getByText('External reference')).toBeInTheDocument();
});

it('reports import errors and forwards asset selection', () => {
  const onSelect = vi.fn();
  const asset = {
    id: 'asset-1',
    name: 'poster.png',
    format: 'PNG' as const,
    mimeType: 'image/png',
    contentHash: 'hash-1',
    managed: true,
  };
  render(<AssetLibrary
    assets={[asset]}
    results={[{ status: 'error', error: 'UNSUPPORTED_FORMAT', item: { name: 'bad.bmp' } }]}
    onSelect={onSelect}
  />);

  expect(screen.getByRole('list', { name: 'Import errors' })).toHaveTextContent('bad.bmp: UNSUPPORTED_FORMAT');
  screen.getByRole('button', { name: 'poster.png' }).click();
  expect(onSelect).toHaveBeenCalledWith(asset);
});

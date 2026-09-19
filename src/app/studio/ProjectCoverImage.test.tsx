import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ProjectCoverImage } from './ProjectCoverImage';

const createObjectURL = vi.fn(() => 'blob:managed-cover');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  Reflect.deleteProperty(window, 'designhub');
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'designhub');
});

it('uses the default cover without reading assets when no cover id exists', () => {
  const readAsset = vi.fn();
  window.designhub = { chooseWorkspaceDirectory: async () => null, readAsset };

  render(<ProjectCoverImage workspaceId="workspace-1" projectId="project-1" alt="春间市集项目封面" />);

  expect(screen.getByRole('img', { name: '春间市集项目封面' })).toHaveAttribute('src', '/project-default-cover.png');
  expect(readAsset).not.toHaveBeenCalled();
});

it('reads a managed project cover and releases its object URL', async () => {
  const readAsset = vi.fn(async () => new Uint8Array([1, 2, 3]));
  window.designhub = { chooseWorkspaceDirectory: async () => null, readAsset };
  const { unmount } = render(<ProjectCoverImage workspaceId="workspace-1" projectId="project-1" coverAssetId="asset-0123456789abcdef" alt="春间市集项目封面" />);

  await waitFor(() => expect(screen.getByRole('img', { name: '春间市集项目封面' })).toHaveAttribute('src', 'blob:managed-cover'));
  expect(readAsset).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1', assetId: 'asset-0123456789abcdef' });
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:managed-cover');
});

it('falls back to the bundled cover when a managed image cannot be displayed', async () => {
  window.designhub = { chooseWorkspaceDirectory: async () => null, readAsset: vi.fn(async () => new Uint8Array([1])) };
  render(<ProjectCoverImage workspaceId="workspace-1" projectId="project-1" coverAssetId="asset-0123456789abcdef" alt="春间市集项目封面" />);
  const image = screen.getByRole('img', { name: '春间市集项目封面' });
  await waitFor(() => expect(image).toHaveAttribute('src', 'blob:managed-cover'));

  fireEvent.error(image);

  expect(image).toHaveAttribute('src', '/project-default-cover.png');
});

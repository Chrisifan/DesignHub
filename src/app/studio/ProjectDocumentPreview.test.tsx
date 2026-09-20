import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createScene } from '../../features/canvas/scene';
import { ProjectDocumentPreview } from './ProjectDocumentPreview';

const createObjectURL = vi.fn(() => 'blob:finalized-document');
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

it('renders the persisted content image and ignores reference layers', async () => {
  const scene = createScene({
    id: 'doc-1',
    width: 1080,
    height: 1440,
    layers: [
      { id: 'reference', type: 'image', role: 'reference', assetId: 'asset-reference', x: 0, y: 0, width: 200, height: 200, rotation: 0, opacity: 1, visible: true, locked: false },
      { id: 'content', type: 'image', role: 'content', assetId: 'asset-final', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
    ],
  });
  const loadDocumentScene = vi.fn(async () => scene);
  const readAsset = vi.fn(async () => new Uint8Array([1, 2, 3]));
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentScene, readAsset };

  const view = render(
    <ProjectDocumentPreview
      workspaceId="workspace-1"
      projectId="project-1"
      documentId="doc-1"
      artwork="market"
      alt="主海报定稿预览"
    />,
  );

  expect(await screen.findByRole('img', { name: '主海报定稿预览' })).toHaveAttribute('src', 'blob:finalized-document');
  expect(readAsset).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1', assetId: 'asset-final' });
  expect(readAsset).not.toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-reference' }));

  view.unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:finalized-document');
});

it('uses a non-reference image when an older scene has no explicit content role', async () => {
  const scene = createScene({
    id: 'doc-1',
    width: 1080,
    height: 1440,
    layers: [
      { id: 'legacy', type: 'image', assetId: 'asset-legacy', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
    ],
  });
  const readAsset = vi.fn(async () => new Uint8Array([1]));
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDocumentScene: vi.fn(async () => scene),
    readAsset,
  };

  render(<ProjectDocumentPreview workspaceId="workspace-1" projectId="project-1" documentId="doc-1" artwork="market" alt="旧文档预览" />);

  expect(await screen.findByRole('img', { name: '旧文档预览' })).toHaveAttribute('src', 'blob:finalized-document');
  expect(readAsset).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1', assetId: 'asset-legacy' });
});

it('falls back to the artwork preview when no formal image can be read', async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDocumentScene: vi.fn(async () => createScene({ id: 'doc-1', width: 100, height: 100, layers: [] })),
    readAsset: vi.fn(async () => null),
  };

  const view = render(<ProjectDocumentPreview workspaceId="workspace-1" projectId="project-1" documentId="doc-1" artwork="market" alt="主海报定稿预览" />);

  await waitFor(() => expect(view.container.querySelector('.artwork--market')).toBeInTheDocument());
  expect(screen.queryByRole('img', { name: '主海报定稿预览' })).not.toBeInTheDocument();
});

it('releases the object URL immediately when the managed image cannot be decoded', async () => {
  const scene = createScene({
    id: 'doc-1',
    width: 1080,
    height: 1440,
    layers: [
      { id: 'content', type: 'image', role: 'content', assetId: 'asset-final', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
    ],
  });
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDocumentScene: vi.fn(async () => scene),
    readAsset: vi.fn(async () => new Uint8Array([1])),
  };
  const view = render(<ProjectDocumentPreview workspaceId="workspace-1" projectId="project-1" documentId="doc-1" artwork="market" alt="损坏图片预览" />);
  const image = await screen.findByRole('img', { name: '损坏图片预览' });

  fireEvent.error(image);

  expect(revokeObjectURL).toHaveBeenCalledWith('blob:finalized-document');
  expect(view.container.querySelector('.artwork--market')).toBeInTheDocument();
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { createScene } from './scene';
import { CanvasWorkspace } from './CanvasWorkspace';

vi.mock('react-konva', () => {
  const component = ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>;
  return { Ellipse: component, Layer: component, Line: component, Rect: component, Stage: component, Text: component };
});

const initial = createScene({ id: 'scene-initial', width: 800, height: 600, layers: [] });
const stored = createScene({ id: 'scene-stored', width: 1080, height: 1440, layers: [] });
const editable = createScene({ id: 'scene-editable', width: 800, height: 600, layers: [{
  id: 'text-1', type: 'text', text: '标题', fontFamily: 'sans-serif', fontSize: 24, fontWeight: '400', align: 'left', color: '#111111',
  x: 10, y: 10, width: 200, height: 40, rotation: 0, opacity: 1, visible: true, locked: false,
}] });

it('hydrates a workspace document scene through the desktop bridge', async () => {
  const loadDocumentScene = vi.fn(async () => stored);
  const onSceneChange = vi.fn();
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentScene };

  render(<CanvasWorkspace locale="zh-CN" scene={initial} workspaceId="workspace-1" projectId="project-1" documentId="doc-1" onSceneChange={onSceneChange} />);

  await waitFor(() => expect(loadDocumentScene).toHaveBeenCalledWith('workspace-1', 'project-1', 'doc-1'));
  await waitFor(() => expect(onSceneChange).toHaveBeenCalledWith(stored));
  expect(screen.getByRole('region', { name: '画布' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('region', { name: '画布' }));
});

it('saves inspector scene changes through the desktop bridge', async () => {
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, saveDocumentScene };

  render(<CanvasWorkspace locale="zh-CN" scene={editable} workspaceId="workspace-1" projectId="project-1" documentId="doc-1" />);

  fireEvent.click(screen.getByText('标题'));
  fireEvent.change(screen.getByRole('spinbutton', { name: '横坐标' }), { target: { value: '42' } });

  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1',
    scene: expect.objectContaining({ layers: [expect.objectContaining({ id: 'text-1', x: 42 })] }),
  })));
});

it('persists the initial scene when a workspace document has no stored scene', async () => {
  const loadDocumentScene = vi.fn(async () => null);
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentScene, saveDocumentScene };
  render(<CanvasWorkspace locale="zh-CN" scene={initial} workspaceId="workspace-1" projectId="project-1" documentId="doc-1" />);
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', scene: initial,
  })));
});

it('requests managed image bytes for image layers in a workspace scene', async () => {
  const readAsset = vi.fn(async () => new Uint8Array([137, 80, 78, 71]));
  window.designhub = { chooseWorkspaceDirectory: async () => null, readAsset };
  const imageScene = createScene({ id: 'scene-image', width: 800, height: 600, layers: [{ id: 'image-1', type: 'image', assetId: 'asset-1', x: 0, y: 0, width: 800, height: 600, rotation: 0, opacity: 1, visible: true, locked: false }] });
  render(<CanvasWorkspace locale="zh-CN" scene={imageScene} workspaceId="workspace-1" projectId="project-1" documentId="doc-1" />);
  await waitFor(() => expect(readAsset).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1', assetId: 'asset-1' }));
});

it('duplicates and deletes layers through the scene persistence bridge', async () => {
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, saveDocumentScene };
  render(<CanvasWorkspace locale="zh-CN" scene={editable} workspaceId="workspace-1" projectId="project-1" documentId="doc-1" />);
  fireEvent.click(screen.getByRole('button', { name: '复制图层' }));
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ scene: expect.objectContaining({ layers: expect.arrayContaining([expect.objectContaining({ id: 'text-1' }), expect.objectContaining({ text: '标题' })]) }) })));
  fireEvent.click(screen.getByRole('button', { name: '删除图层' }));
  fireEvent.click(screen.getByRole('button', { name: '删除图层' }));
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ scene: expect.objectContaining({ layers: [] }) })));
});

it('applies a pending asset action after hydrating the workspace scene', async () => {
  const loadDocumentScene = vi.fn(async () => editable);
  const saveDocumentScene = vi.fn(async () => true);
  const onSceneChange = vi.fn();
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentScene, saveDocumentScene };
  render(<CanvasWorkspace
    locale="zh-CN"
    scene={initial}
    workspaceId="workspace-1"
    projectId="project-1"
    documentId="doc-1"
    onSceneChange={onSceneChange}
    assetAction={{ id: 'action-1', assetId: 'asset-1', mode: 'place' }}
  />);
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({
    scene: expect.objectContaining({ layers: expect.arrayContaining([expect.objectContaining({ assetId: 'asset-1', type: 'image' })]) }),
  })));
  expect(onSceneChange).toHaveBeenCalledWith(expect.objectContaining({ layers: expect.arrayContaining([expect.objectContaining({ assetId: 'asset-1' })]) }));
});

it('toggles shift multi-selection and persists a renamed layer', async () => {
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, saveDocumentScene };
  const multi = createScene({ id: 'scene-multi', width: 800, height: 600, layers: [
    { id: 'text-1', type: 'text', text: '标题', fontFamily: 'sans-serif', fontSize: 24, fontWeight: '400', align: 'left', color: '#111111', x: 10, y: 10, width: 200, height: 40, rotation: 0, opacity: 1, visible: true, locked: false },
    { id: 'text-2', type: 'text', text: '副标题', fontFamily: 'sans-serif', fontSize: 24, fontWeight: '400', align: 'left', color: '#111111', x: 10, y: 60, width: 200, height: 40, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  render(<CanvasWorkspace locale="zh-CN" scene={multi} workspaceId="workspace-1" projectId="project-1" documentId="doc-1" />);
  const rows = screen.getAllByRole('button', { name: /标题|副标题/ });
  fireEvent.click(rows[0]!);
  fireEvent.click(rows[1]!, { shiftKey: true });
  expect(rows[1]).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(rows[1]!, { shiftKey: true });
  expect(rows[1]).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(rows[0]!);
  fireEvent.change(screen.getByRole('textbox', { name: '图层名称' }), { target: { value: '主标题' } });
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ scene: expect.objectContaining({ layers: expect.arrayContaining([expect.objectContaining({ name: '主标题' })]) }) })));
  fireEvent.click(rows[1]!, { shiftKey: true });
  fireEvent.change(screen.getByRole('spinbutton', { name: '不透明度' }), { target: { value: '0.5' } });
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ scene: expect.objectContaining({ layers: expect.arrayContaining([expect.objectContaining({ opacity: 0.5 }), expect.objectContaining({ opacity: 0.5 })]) }) })));
});

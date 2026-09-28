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
const stored = createScene({ id: 'scene-stored', width: 1080, height: 1440, layers: [{
  id: 'content-final', type: 'image', role: 'content', assetId: 'asset-final', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false,
}] });
const editable = createScene({ id: 'scene-editable', width: 800, height: 600, layers: [{
  id: 'text-1', type: 'text', text: '标题', fontFamily: 'sans-serif', fontSize: 24, fontWeight: '400', align: 'left', color: '#111111',
  x: 10, y: 10, width: 200, height: 40, rotation: 0, opacity: 1, visible: true, locked: false,
}] });

it('renders an embedded stage without duplicate canvas chrome', () => {
  render(<CanvasWorkspace locale="zh-CN" scene={editable} embedded />);

  expect(screen.getByRole('region', { name: '画布' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '画布' })).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: '图层' })).not.toBeInTheDocument();
});

it('does not render a blank white artboard when no image layer exists', () => {
  render(<CanvasWorkspace locale="zh-CN" scene={initial} embedded />);

  expect(screen.queryByTestId('canvas-surface')).not.toBeInTheDocument();
});

it('renders the artboard surface when a visible managed image exists', () => {
  const imageScene = createScene({ id: 'scene-image-surface', width: 800, height: 600, layers: [{ id: 'image-1', type: 'image', assetId: 'asset-1', x: 0, y: 0, width: 800, height: 600, rotation: 0, opacity: 1, visible: true, locked: false }] });
  const getContext = HTMLCanvasElement.prototype.getContext;
  const userAgent = window.navigator.userAgent;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({}) });
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: 'test-browser' });
  try {
    render(<CanvasWorkspace locale="zh-CN" scene={imageScene} embedded />);
    expect(screen.getByTestId('canvas-surface')).toBeInTheDocument();
  } finally {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: getContext });
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent });
  }
});

it('keeps real scene layers and properties available as embedded overlays', () => {
  const onLayersClose = vi.fn();
  render(
    <CanvasWorkspace
      locale="zh-CN"
      scene={editable}
      embedded
      layersOpen
      onLayersClose={onLayersClose}
    />,
  );

  expect(screen.getByRole('complementary', { name: '图层' })).toBeInTheDocument();
  fireEvent.click(screen.getByText('标题'));
  expect(screen.getByRole('complementary', { name: '检查器' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: '检查器' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭图层' }));
  expect(onLayersClose).toHaveBeenCalledOnce();
});

it('selects the first interactive layer when the embedded inspector is requested without a selection', () => {
  render(
    <CanvasWorkspace
      locale="zh-CN"
      scene={editable}
      embedded
      inspectorRequestId={1}
    />,
  );

  expect(screen.getByRole('complementary', { name: '检查器' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '文字内容' })).toHaveValue('标题');
});

it('opens the inspector drawer for a selected layer and closes it when selection clears', () => {
  render(<CanvasWorkspace locale="zh-CN" scene={editable} />);

  fireEvent.click(screen.getByText('标题'));
  expect(screen.getByRole('dialog', { name: '检查器' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('region', { name: '画布' }));
  expect(screen.queryByRole('dialog', { name: '检查器' })).not.toBeInTheDocument();
});

it('hydrates a finalized workspace scene without overwriting it with the initial scene', async () => {
  const loadDocumentScene = vi.fn(async () => stored);
  const saveDocumentScene = vi.fn(async () => true);
  const onSceneChange = vi.fn();
  window.designhub = { loadDocumentScene, saveDocumentScene };

  render(<CanvasWorkspace locale="zh-CN" scene={initial} libraryId="workspace-1" projectId="project-1" documentId="doc-1" onSceneChange={onSceneChange} />);

  await waitFor(() => expect(loadDocumentScene).toHaveBeenCalledWith('workspace-1', 'project-1', 'doc-1'));
  await waitFor(() => expect(onSceneChange).toHaveBeenCalledWith(stored));
  expect(saveDocumentScene).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: '画布' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('region', { name: '画布' }));
});

it('saves inspector scene changes through the desktop bridge', async () => {
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { saveDocumentScene };

  render(<CanvasWorkspace locale="zh-CN" scene={editable} libraryId="workspace-1" projectId="project-1" documentId="doc-1" />);

  fireEvent.click(screen.getByText('标题'));
  fireEvent.change(screen.getByRole('spinbutton', { name: '横坐标' }), { target: { value: '42' } });

  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1',
    scene: expect.objectContaining({ layers: [expect.objectContaining({ id: 'text-1', x: 42 })] }),
  })));
});

it('persists the initial scene when a workspace document has no stored scene', async () => {
  const loadDocumentScene = vi.fn(async () => null);
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { loadDocumentScene, saveDocumentScene };
  render(<CanvasWorkspace locale="zh-CN" scene={initial} libraryId="workspace-1" projectId="project-1" documentId="doc-1" />);
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', scene: initial,
  })));
});

it('requests managed image bytes for image layers in a workspace scene', async () => {
  const readAsset = vi.fn(async () => new Uint8Array([137, 80, 78, 71]));
  window.designhub = { readAsset };
  const imageScene = createScene({ id: 'scene-image', width: 800, height: 600, layers: [{ id: 'image-1', type: 'image', assetId: 'asset-1', x: 0, y: 0, width: 800, height: 600, rotation: 0, opacity: 1, visible: true, locked: false }] });
  render(<CanvasWorkspace locale="zh-CN" scene={imageScene} libraryId="workspace-1" projectId="project-1" documentId="doc-1" />);
  await waitFor(() => expect(readAsset).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'project-1', assetId: 'asset-1' }));
});

it('duplicates and deletes layers through the scene persistence bridge', async () => {
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { saveDocumentScene };
  render(<CanvasWorkspace locale="zh-CN" scene={editable} libraryId="workspace-1" projectId="project-1" documentId="doc-1" />);
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
  window.designhub = { loadDocumentScene, saveDocumentScene };
  render(<CanvasWorkspace
    locale="zh-CN"
    scene={initial}
    libraryId="workspace-1"
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
  window.designhub = { saveDocumentScene };
  const multi = createScene({ id: 'scene-multi', width: 800, height: 600, layers: [
    { id: 'text-1', type: 'text', text: '标题', fontFamily: 'sans-serif', fontSize: 24, fontWeight: '400', align: 'left', color: '#111111', x: 10, y: 10, width: 200, height: 40, rotation: 0, opacity: 1, visible: true, locked: false },
    { id: 'text-2', type: 'text', text: '副标题', fontFamily: 'sans-serif', fontSize: 24, fontWeight: '400', align: 'left', color: '#111111', x: 10, y: 60, width: 200, height: 40, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  render(<CanvasWorkspace locale="zh-CN" scene={multi} libraryId="workspace-1" projectId="project-1" documentId="doc-1" />);
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

it('reports the selected layer identity to the workbench', () => {
  const onSelectionChange = vi.fn();
  const scene = createScene({ id: 'selection-scene', width: 800, height: 600, layers: [
    { id: 'image-a', type: 'image', assetId: 'asset-a', x: 0, y: 0, width: 400, height: 300, rotation: 0, opacity: 1, visible: true, locked: false },
    { id: 'image-b', type: 'image', assetId: 'asset-b', x: 400, y: 0, width: 400, height: 300, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });

  render(<CanvasWorkspace locale="zh-CN" scene={scene} embedded layersOpen onSelectionChange={onSelectionChange} />);

  fireEvent.click(screen.getByRole('button', { name: 'asset-a' }));
  expect(onSelectionChange).toHaveBeenLastCalledWith({ layerId: 'image-a', type: 'image' });
  fireEvent.click(screen.getByRole('button', { name: 'asset-b' }));
  expect(onSelectionChange).toHaveBeenLastCalledWith({ layerId: 'image-b', type: 'image' });
});

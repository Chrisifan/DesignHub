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

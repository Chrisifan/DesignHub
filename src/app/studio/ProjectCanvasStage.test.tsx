import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectCanvasStage, centerNodeInViewport, layoutProjectDesigns, panViewport, zoomAroundPointer } from './ProjectCanvasStage';

type KonvaMockProps = {
  children?: ReactNode;
  onClick?: (event: { cancelBubble: boolean }) => void;
  onDblClick?: (event: { cancelBubble: boolean }) => void;
  onMouseDown?: (event: { target: { getClassName: () => string } }) => void;
  stroke?: string;
};

vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown }: KonvaMockProps) => <div data-testid="konva-stage" onMouseDown={() => onMouseDown?.({ target: { getClassName: () => 'Stage' } })}>{children}</div>,
  Layer: ({ children }: KonvaMockProps) => <div>{children}</div>,
  Rect: () => <div />,
  Image: ({ onClick, onDblClick, stroke }: KonvaMockProps) => (
    <button
      type="button"
      data-testid="design-image"
      data-stroke={stroke}
      onClick={() => onClick?.({ cancelBubble: false })}
      onDoubleClick={() => onDblClick?.({ cancelBubble: false })}
    />
  ),
}));

const designs = [
  { id: 'a', width: 400, height: 300 },
  { id: 'b', width: 400, height: 300 },
  { id: 'c', width: 400, height: 300 },
];

describe('project canvas math', () => {
  it('lays designs left to right and wraps at the maximum width', () => {
    const positions = layoutProjectDesigns(designs, { maxWidth: 900, gap: 24 });
    expect(positions).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 424, y: 0 },
      c: { x: 0, y: 324 },
    });
  });

  it('keeps designs from the same generation task on one row', () => {
    const positions = layoutProjectDesigns([
      { id: 'a', width: 1080, height: 1440, rowKey: 'task-1' },
      { id: 'b', width: 1080, height: 1440, rowKey: 'task-1' },
      { id: 'c', width: 1080, height: 1440, rowKey: 'task-2' },
    ]);
    expect(positions).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 1104, y: 0 },
      c: { x: 0, y: 1464 },
    });
  });

  it('zooms around the pointer without moving the content under the pointer', () => {
    expect(zoomAroundPointer({ zoom: 1, offsetX: 0, offsetY: 0 }, { x: 200, y: 100 }, 2)).toEqual({ zoom: 2, offsetX: -200, offsetY: -100 });
  });

  it('pans the viewport and centers a node in the stage', () => {
    expect(panViewport({ zoom: 1, offsetX: 10, offsetY: 20 }, { x: 5, y: -10 })).toEqual({ zoom: 1, offsetX: 15, offsetY: 10 });
    expect(centerNodeInViewport({ x: 400, y: 300, width: 200, height: 100 }, { width: 1000, height: 700 }, 1)).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  });
});

describe('project canvas design interactions', () => {
  it('selects on a single click and adds to conversation only on a double click', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const onSelect = vi.fn();
    const onAddToConversation = vi.fn();
    render(
      <ProjectCanvasStage
        projectId="project-1"
        designs={[{ id: 'design-1', assetId: 'asset-1', sourceTaskId: 'generation-1', width: 1080, height: 1440, title: 'Poster', createdAt: '2026-09-21T00:00:00.000Z' }]}
        selectedDesignIds={[]}
        onSelect={onSelect}
        onAddToConversation={onAddToConversation}
      />,
    );

    const design = screen.getByTestId('design-image');
    fireEvent.click(design);
    expect(onSelect).toHaveBeenCalledWith('design-1');
    expect(onAddToConversation).not.toHaveBeenCalled();

    fireEvent.doubleClick(design);
    expect(onAddToConversation).toHaveBeenCalledWith('design-1');
    userAgent.mockRestore();
  });

  it('draws the selected treatment on every selected design', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    render(
      <ProjectCanvasStage
        projectId="project-1"
        designs={[
          { id: 'design-1', assetId: 'asset-1', sourceTaskId: 'generation-1', width: 1080, height: 1440, title: 'First', createdAt: '2026-09-21T00:00:00.000Z' },
          { id: 'design-2', assetId: 'asset-2', sourceTaskId: 'generation-1', width: 1080, height: 1440, title: 'Second', createdAt: '2026-09-21T00:01:00.000Z' },
        ]}
        selectedDesignIds={['design-1', 'design-2']}
        onSelect={vi.fn()}
        onAddToConversation={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('design-image').map((image) => image.dataset.stroke)).toEqual(['#2563eb', '#2563eb']);
    userAgent.mockRestore();
  });

  it('reports a true canvas background press', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const onCanvasBackground = vi.fn();
    render(<ProjectCanvasStage projectId="project-1" designs={[]} onSelect={vi.fn()} onCanvasBackground={onCanvasBackground} />);

    fireEvent.mouseDown(screen.getByTestId('konva-stage'));

    expect(onCanvasBackground).toHaveBeenCalledOnce();
    userAgent.mockRestore();
  });

  it('does not report a design press as canvas background', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const onCanvasBackground = vi.fn();
    render(
      <ProjectCanvasStage
        projectId="project-1"
        designs={[{ id: 'design-1', assetId: 'asset-1', sourceTaskId: 'generation-1', width: 1080, height: 1440, title: 'Poster', createdAt: '2026-09-21T00:00:00.000Z' }]}
        onSelect={vi.fn()}
        onCanvasBackground={onCanvasBackground}
      />,
    );

    fireEvent.click(screen.getByTestId('design-image'));

    expect(onCanvasBackground).not.toHaveBeenCalled();
    userAgent.mockRestore();
  });
});

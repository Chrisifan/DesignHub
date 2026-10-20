import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectCanvasStage, centerNodeInViewport, generationPlaceholderViewport, layoutAnchoredCanvasNodes, layoutProjectDesigns, panViewport, persistedCanvasNodes, zoomAroundPointer } from './ProjectCanvasStage';

type KonvaMockProps = {
  children?: ReactNode;
  onClick?: (event: { cancelBubble: boolean }) => void;
  onDblClick?: (event: { cancelBubble: boolean }) => void;
  onMouseDown?: (event: { target: { getClassName: () => string } }) => void;
  stroke?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  fontStyle?: string;
  image?: unknown;
  id?: string;
  width?: number;
  height?: number;
  draggable?: boolean;
  scaleX?: number;
  onWheel?: (event: { evt: { deltaY: number } }) => void;
};

vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown, onWheel, scaleX, x, y }: KonvaMockProps) => <div data-testid="konva-stage" data-zoom={scaleX} data-x={x} data-y={y} onWheel={() => onWheel?.({ evt: { deltaY: 1 } })} onMouseDown={() => onMouseDown?.({ target: { getClassName: () => 'Stage' } })}>{children}</div>,
  Layer: ({ children }: KonvaMockProps) => <div>{children}</div>,
  Rect: ({ x, y, id, width, height }: KonvaMockProps) => <div data-testid="pending-rect" data-id={id} data-x={x} data-y={y} data-width={width} data-height={height} />,
  Text: ({ x, y, fontSize, fontStyle }: KonvaMockProps) => <div data-testid="settled-label" data-x={x} data-y={y} data-font-size={fontSize} data-font-style={fontStyle} />,
  Image: ({ onClick, onDblClick, stroke, id, x, y, width, height }: KonvaMockProps) => (
    <button
      type="button"
      data-testid="design-image"
      data-id={id}
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
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

  it('places an anchored pending result immediately to the right of its source', () => {
    const positions = layoutProjectDesigns([
      { id: 'source', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'sibling', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'pending', width: 400, height: 300, rowKey: 'source-row', anchorId: 'source' },
    ], { maxWidth: 1280, gap: 24 });

    expect(positions.source).toEqual({ x: 0, y: 0 });
    expect(positions.pending).toEqual({ x: 424, y: 0 });
    expect(positions.sibling).toEqual({ x: 848, y: 0 });
  });

  it('inserts pending results into the current row and pushes siblings without creating a phantom row', () => {
    const designs = [
      { id: 'source', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'sibling', width: 400, height: 300, rowKey: 'different-task' },
      { id: 'other-row', width: 400, height: 300, rowKey: 'other-row' },
    ];
    const currentNodes = {
      source: { x: 100, y: 20 },
      sibling: { x: 524, y: 20 },
      'other-row': { x: 100, y: 420 },
    };
    const pending = [{ id: 'pending', width: 400, height: 300, rowKey: 'source-row', anchorId: 'source', status: 'running' as const }];

    expect(layoutAnchoredCanvasNodes(designs, pending, currentNodes)).toEqual({
      source: { x: 100, y: 20 },
      pending: { x: 524, y: 20 },
      sibling: { x: 948, y: 20 },
      'other-row': { x: 100, y: 420 },
    });
    expect(layoutAnchoredCanvasNodes(designs, [], currentNodes)).toEqual(currentNodes);
  });

  it('does not mutate persisted node points while calculating a temporary insertion', () => {
    const currentNodes = {
      source: { x: 100, y: 20 },
      sibling: { x: 524, y: 20 },
    };
    const snapshot = structuredClone(currentNodes);

    expect(layoutAnchoredCanvasNodes([
      { id: 'source', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'sibling', width: 400, height: 300, rowKey: 'source-row' },
    ], [{ id: 'pending', width: 400, height: 300, rowKey: 'source-row', anchorId: 'source', status: 'running' as const }], currentNodes)).toEqual({
      source: { x: 100, y: 20 },
      pending: { x: 524, y: 20 },
      sibling: { x: 948, y: 20 },
    });
    expect(currentNodes).toEqual(snapshot);
  });

  it('keeps an inserted placeholder and its siblings fixed when the source moves', () => {
    const currentNodes = {
      source: { x: 300, y: 420 },
      pending: { x: 524, y: 20 },
      sibling: { x: 948, y: 20 },
    };

    expect(layoutAnchoredCanvasNodes([
      { id: 'source', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'sibling', width: 400, height: 300, rowKey: 'source-row' },
    ], [{ id: 'pending', width: 400, height: 300, rowKey: 'source-row', anchorId: 'source', status: 'running' as const }], currentNodes)).toEqual(currentNodes);
  });

  it('replaces a placeholder with its completed design without shifting siblings again', () => {
    const currentNodes = {
      source: { x: 100, y: 20 },
      'task-edit': { x: 524, y: 20 },
      sibling: { x: 948, y: 20 },
    };

    expect(layoutAnchoredCanvasNodes([
      { id: 'source', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'result', sourceTaskId: 'task-edit', width: 400, height: 300, rowKey: 'source-row', anchorId: 'source' },
      { id: 'sibling', width: 400, height: 300, rowKey: 'source-row' },
    ], [], currentNodes)).toEqual({
      source: { x: 100, y: 20 },
      result: { x: 524, y: 20 },
      sibling: { x: 948, y: 20 },
    });
  });

  it('keeps completed generation slots in their original placeholder positions', () => {
    const currentNodes = {
      source: { x: 100, y: 20 },
      'task-generation-primary': { x: 524, y: 20 },
      'task-generation-composition': { x: 948, y: 20 },
      'task-generation-expressive': { x: 1372, y: 20 },
      'result-primary': { x: 999, y: 420 },
    };

    expect(layoutAnchoredCanvasNodes([
      { id: 'source', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'result-expressive', sourceTaskId: 'task-generation', nodeId: 'task-generation-expressive', width: 400, height: 300, rowKey: 'task-generation' },
      { id: 'result-primary', sourceTaskId: 'task-generation', nodeId: 'task-generation-primary', width: 400, height: 300, rowKey: 'task-generation' },
      { id: 'result-composition', sourceTaskId: 'task-generation', nodeId: 'task-generation-composition', width: 400, height: 300, rowKey: 'task-generation' },
    ], [], currentNodes)).toEqual({
      source: { x: 100, y: 20 },
      'result-primary': { x: 524, y: 20 },
      'result-composition': { x: 948, y: 20 },
      'result-expressive': { x: 1372, y: 20 },
    });
  });

  it('excludes temporary placeholder nodes from persisted canvas layout', () => {
    expect(persistedCanvasNodes(
      [{ id: 'source', width: 400, height: 300 }, { id: 'sibling', width: 400, height: 300 }],
      {
        source: { x: 100, y: 20 },
        'task-edit': { x: 524, y: 20 },
        sibling: { x: 948, y: 20 },
      },
    )).toEqual({
      source: { x: 100, y: 20 },
      sibling: { x: 948, y: 20 },
    });
  });

  it('repairs an anchored result that was persisted on a different row', () => {
    const designs = [
      { id: 'source', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'sibling', width: 400, height: 300, rowKey: 'source-row' },
      { id: 'result', width: 400, height: 300, rowKey: 'source-row', anchorId: 'source' },
    ];
    const currentNodes = {
      source: { x: 100, y: 20 },
      sibling: { x: 524, y: 20 },
      result: { x: 100, y: 420 },
    };

    expect(layoutAnchoredCanvasNodes(designs, [], currentNodes)).toEqual({
      source: { x: 100, y: 20 },
      result: { x: 524, y: 20 },
      sibling: { x: 948, y: 20 },
    });
  });

  it('appends unanchored pending items in their existing task row', () => {
    const designs = [{ id: 'source', width: 400, height: 300, rowKey: 'generation' }];
    const pending = [
      { id: 'pending-1', width: 400, height: 300, rowKey: 'generation', status: 'running' as const },
      { id: 'pending-2', width: 400, height: 300, rowKey: 'generation', status: 'running' as const },
    ];

    expect(layoutAnchoredCanvasNodes(designs, pending, { source: { x: 100, y: 20 } })).toEqual({
      source: { x: 100, y: 20 },
      'pending-1': { x: 524, y: 20 },
      'pending-2': { x: 948, y: 20 },
    });
  });

  it('persists the inserted result position together with shifted siblings', async () => {
    const onLayoutChange = vi.fn();
    const source = { id: 'source', width: 400, height: 300, sourceTaskId: 'generation-1', title: 'Source', assetId: 'asset-source', createdAt: '2026-10-10T00:00:00.000Z' };
    const sibling = { id: 'sibling', width: 400, height: 300, sourceTaskId: 'generation-1', title: 'Sibling', assetId: 'asset-sibling', createdAt: '2026-10-10T00:01:00.000Z' };
    const result = { id: 'result', width: 400, height: 300, sourceTaskId: 'task-edit', title: 'Result', assetId: 'asset-result', createdAt: '2026-10-10T00:02:00.000Z' };
    const initialNodes = { source: { x: 100, y: 20 }, sibling: { x: 524, y: 20 } };
    const { rerender } = render(
      <ProjectCanvasStage
        projectId="project-1"
        designs={[source, sibling]}
        initialNodes={initialNodes}
        onSelect={vi.fn()}
        onLayoutChange={onLayoutChange}
      />,
    );
    onLayoutChange.mockClear();

    await act(async () => {
      rerender(
        <ProjectCanvasStage
          projectId="project-1"
          designs={[source, result, sibling]}
          initialNodes={initialNodes}
          designAnchors={{ result: 'source' }}
          onSelect={vi.fn()}
          onLayoutChange={onLayoutChange}
        />,
      );
    });

    await vi.waitFor(() => expect(onLayoutChange).toHaveBeenCalledWith(expect.objectContaining({
      nodes: {
        source: { x: 100, y: 20 },
        result: { x: 524, y: 20 },
        sibling: { x: 948, y: 20 },
      },
    })));
  });

  it('centers each automatic row within the layout width', () => {
    const positions = layoutProjectDesigns([
      { id: 'a', width: 400, height: 300, rowKey: 'task-1' },
      { id: 'b', width: 400, height: 300, rowKey: 'task-1' },
      { id: 'c', width: 400, height: 300, rowKey: 'task-2' },
    ], { maxWidth: 900, gap: 24, centerRows: true });

    expect(positions).toEqual({
      a: { x: 38, y: 0 },
      b: { x: 462, y: 0 },
      c: { x: 250, y: 324 },
    });
  });

  it('zooms around the pointer without moving the content under the pointer', () => {
    expect(zoomAroundPointer({ zoom: 1, offsetX: 0, offsetY: 0 }, { x: 200, y: 100 }, 2)).toEqual({ zoom: 2, offsetX: -200, offsetY: -100 });
  });

  it('pans the viewport and centers a node in the stage', () => {
    expect(panViewport({ zoom: 1, offsetX: 10, offsetY: 20 }, { x: 5, y: -10 })).toEqual({ zoom: 1, offsetX: 15, offsetY: 10 });
    expect(centerNodeInViewport({ x: 400, y: 300, width: 200, height: 100 }, { width: 1000, height: 700 }, 1)).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  });

  it.each([[1080, 1440], [4096, 2048], [2048, 2048]])('uses the same screen size for a %i × %i generation', (width, height) => {
    const viewport = generationPlaceholderViewport([{ x: 2000, y: 3000, width, height }], { width: 1200, height: 760 });
    expect(Math.max(width, height) * viewport.zoom).toBeCloseTo(320);
    expect((2000 + width / 2) * viewport.zoom + viewport.offsetX).toBeCloseTo(600);
    expect((3000 + height / 2) * viewport.zoom + viewport.offsetY).toBeCloseTo(380);
  });

  it('fits an entire wide batch inside a small canvas with padding', () => {
    const viewport = generationPlaceholderViewport([
      { x: 0, y: 0, width: 2048, height: 1024 },
      { x: 2072, y: 0, width: 2048, height: 1024 },
      { x: 4144, y: 0, width: 2048, height: 1024 },
    ], { width: 600, height: 400 });
    expect(viewport.offsetX).toBeCloseTo(48);
    expect(6192 * viewport.zoom + viewport.offsetX).toBeCloseTo(552);
    expect(512 * viewport.zoom + viewport.offsetY).toBeCloseTo(200);
  });

  it('does not jump to 20 percent when zooming out from a normalized high-resolution image', () => {
    expect(zoomAroundPointer({ zoom: 0.078125, offsetX: 0, offsetY: 0 }, { x: 200, y: 100 }, 0.07).zoom).toBe(0.07);
  });
});

describe('project canvas design interactions', () => {
  it.each([undefined, { zoom: 0.2, offsetX: -900, offsetY: 700 }, { zoom: 2, offsetX: 500, offsetY: -300 }])('normalizes and centers a new placeholder regardless of the previous viewport %j', (viewport) => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(760);
    const { rerender } = render(<ProjectCanvasStage projectId="project-1" designs={[]} viewport={viewport} onSelect={vi.fn()} />);
    rerender(<ProjectCanvasStage projectId="project-1" designs={[]} viewport={viewport} pendingDesigns={[{ id: 'generation-primary', rowKey: 'generation', width: 1080, height: 1440 }]} onSelect={vi.fn()} />);

    const stage = screen.getByTestId('konva-stage');
    const rect = screen.getByTestId('pending-rect');
    const zoom = Number(stage.dataset.zoom);
    expect(1440 * zoom).toBeCloseTo(320);
    expect(Number(rect.dataset.x) * zoom + Number(stage.dataset.x) + 1080 * zoom / 2).toBeCloseTo(600);
    expect(Number(rect.dataset.y) * zoom + Number(stage.dataset.y) + 1440 * zoom / 2).toBeCloseTo(380);
    width.mockRestore();
    height.mockRestore();
    userAgent.mockRestore();
  });

  it('keeps an active batch centered at its normalized zoom without saving on every task refresh', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(760);
    const pending = ['primary', 'composition', 'expressive'].map((slot) => ({ id: `generation-${slot}`, rowKey: 'generation', width: 1080, height: 1440 }));
    const onLayoutChange = vi.fn();
    const { rerender } = render(<ProjectCanvasStage projectId="project-1" designs={[]} pendingDesigns={pending} onSelect={vi.fn()} onLayoutChange={onLayoutChange} />);
    const stage = screen.getByTestId('konva-stage');
    const rects = screen.getAllByTestId('pending-rect');
    const zoom = Number(stage.dataset.zoom);
    expect(1440 * zoom).toBeCloseTo(320);
    const left = Number(rects[0]!.dataset.x) * zoom + Number(stage.dataset.x);
    const right = (Number(rects[2]!.dataset.x) + 1080) * zoom + Number(stage.dataset.x);
    expect((left + right) / 2).toBeCloseTo(600);
    expect(onLayoutChange).toHaveBeenCalled();

    onLayoutChange.mockClear();
    rerender(<ProjectCanvasStage projectId="project-1" designs={[]} pendingDesigns={pending.map((item) => ({ ...item }))} onSelect={vi.fn()} onLayoutChange={onLayoutChange} />);
    expect(onLayoutChange).not.toHaveBeenCalled();
    fireEvent.wheel(stage);
    expect(Number(stage.dataset.zoom)).toBeCloseTo(zoom);
    rerender(<ProjectCanvasStage projectId="project-1" designs={[]} pendingDesigns={pending.map((item) => ({ ...item }))} onSelect={vi.fn()} onLayoutChange={onLayoutChange} />);
    expect(Number(stage.dataset.zoom)).toBeCloseTo(zoom);

    rerender(<ProjectCanvasStage projectId="project-1" designs={[]} pendingDesigns={[{ id: 'next-primary', rowKey: 'next', width: 2048, height: 1024 }]} onSelect={vi.fn()} onLayoutChange={onLayoutChange} />);
    expect(2048 * Number(stage.dataset.zoom)).toBeCloseTo(320);
    width.mockRestore();
    height.mockRestore();
    userAgent.mockRestore();
  });

  it('recenters the remaining placeholders when one result completes, then releases the viewport after all tasks finish', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(760);
    const pending = ['primary', 'composition', 'expressive'].map((slot) => ({ id: `generation-${slot}`, rowKey: 'generation', width: 1080, height: 1440 }));
    const { rerender } = render(<ProjectCanvasStage projectId="project-1" designs={[]} pendingDesigns={pending} onSelect={vi.fn()} />);
    const stage = screen.getByTestId('konva-stage');
    rerender(<ProjectCanvasStage projectId="project-1" designs={[{
      id: 'result-primary', assetId: 'asset-primary', sourceTaskId: 'generation', width: 1080, height: 1440, title: 'Primary', createdAt: '2026-10-20T00:00:00.000Z',
    }]} designNodeIds={{ 'result-primary': 'generation-primary' }} pendingDesigns={pending.slice(1)} onSelect={vi.fn()} />);
    const rects = screen.getAllByTestId('pending-rect');
    const zoom = Number(stage.dataset.zoom);
    expect(((Number(rects[0]!.dataset.x) + Number(rects[1]!.dataset.x) + 1080) / 2) * zoom + Number(stage.dataset.x)).toBeCloseTo(600);
    expect(Number(rects[0]!.dataset.y) * zoom + 1440 * zoom / 2 + Number(stage.dataset.y)).toBeCloseTo(380);
    rerender(<ProjectCanvasStage projectId="project-1" designs={[]} pendingDesigns={[]} onSelect={vi.fn()} />);
    fireEvent.wheel(stage);
    expect(Number(stage.dataset.zoom)).toBeCloseTo(zoom * 0.92);
    width.mockRestore();
    height.mockRestore();
    userAgent.mockRestore();
  });

  it('keeps restored tasks from different batches centered after resizing and loading persisted positions', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(760);
    const pending = [
      { id: 'first-primary', rowKey: 'first', width: 1080, height: 1440 },
      { id: 'second-primary', rowKey: 'second', width: 1080, height: 1440 },
    ];
    const onLayoutChange = vi.fn();
    const { rerender } = render(<ProjectCanvasStage projectId="project-1" designs={[]} pendingDesigns={pending} onSelect={vi.fn()} onLayoutChange={onLayoutChange} />);
    const stage = screen.getByTestId('konva-stage');
    const expectCentered = (centerX: number, centerY: number): void => {
      const rects = screen.getAllByTestId('pending-rect');
      const left = Math.min(...rects.map((rect) => Number(rect.dataset.x)));
      const right = Math.max(...rects.map((rect) => Number(rect.dataset.x) + 1080));
      const top = Math.min(...rects.map((rect) => Number(rect.dataset.y)));
      const bottom = Math.max(...rects.map((rect) => Number(rect.dataset.y) + 1440));
      const zoom = Number(stage.dataset.zoom);
      expect((left + right) * zoom / 2 + Number(stage.dataset.x)).toBeCloseTo(centerX);
      expect((top + bottom) * zoom / 2 + Number(stage.dataset.y)).toBeCloseTo(centerY);
    };
    expectCentered(600, 380);
    width.mockReturnValue(900);
    height.mockReturnValue(600);
    fireEvent(window, new Event('resize'));
    expectCentered(450, 300);
    rerender(<ProjectCanvasStage projectId="project-1" designs={[]} pendingDesigns={pending} initialNodes={{ 'first-primary': { x: 8000, y: 9000 }, 'second-primary': { x: 8000, y: 10464 } }} onSelect={vi.fn()} onLayoutChange={onLayoutChange} />);
    expectCentered(450, 300);
    width.mockRestore();
    height.mockRestore();
    userAgent.mockRestore();
  });

  it('keeps a pending placeholder fixed after the source receives a new persisted position', async () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    const interval = vi.spyOn(window, 'setInterval').mockReturnValue({} as ReturnType<typeof window.setInterval>);
    const source = { id: 'source', assetId: 'asset-source', sourceTaskId: 'generation-1', width: 400, height: 300, title: 'Source', createdAt: '2026-10-10T00:00:00.000Z' };
    const sibling = { id: 'sibling', assetId: 'asset-sibling', sourceTaskId: 'generation-1', width: 400, height: 300, title: 'Sibling', createdAt: '2026-10-10T00:01:00.000Z' };
    const pending = [{ id: 'task-edit', width: 400, height: 300, rowKey: 'generation-1', anchorId: 'source', status: 'running' as const }];
    const { rerender } = render(
      <ProjectCanvasStage
        projectId="project-1"
        designs={[source, sibling]}
        initialNodes={{ source: { x: 100, y: 20 }, sibling: { x: 524, y: 20 } }}
        pendingDesigns={pending}
        onSelect={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(screen.getByTestId('pending-rect')).toHaveAttribute('data-x', '524'));

    await act(async () => {
      rerender(
        <ProjectCanvasStage
          projectId="project-1"
          designs={[source, sibling]}
          initialNodes={{ source: { x: 300, y: 420 }, sibling: { x: 948, y: 20 } }}
          pendingDesigns={pending}
          onSelect={vi.fn()}
        />,
      );
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId('pending-rect')).toHaveAttribute('data-x', '524');
      expect(screen.getByTestId('pending-rect')).toHaveAttribute('data-y', '20');
      const siblingNode = screen.getAllByTestId('design-image')[1];
      expect(siblingNode).toHaveAttribute('data-x', '948');
      expect(siblingNode).toHaveAttribute('data-y', '20');
    });
    interval.mockRestore();
    userAgent.mockRestore();
  });

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

  it('forwards dragged image files to the canvas importer', () => {
    const onImportImages = vi.fn();
    render(<ProjectCanvasStage projectId="project-1" designs={[]} onSelect={vi.fn()} onImportImages={onImportImages} />);
    const file = new File(['image'], 'canvas.png', { type: 'image/png' });

    fireEvent.drop(screen.getByTestId('project-canvas-stage'), { dataTransfer: { files: [file] } });

    expect(onImportImages).toHaveBeenCalledWith([file]);
  });

  it('keeps a failed pending result visible with an accessible error status', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('jsdom');
    render(
      <ProjectCanvasStage
        projectId="project-1"
        designs={[]}
        pendingDesigns={[{ id: 'task-failed', width: 400, height: 300, status: 'failed', errorCode: 'RESULT_DIMENSIONS_INVALID' }]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: '处理失败 task-failed' })).toBeInTheDocument();
    userAgent.mockRestore();
  });

  it('uses a compact non-bold label for settled pending results', () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
    render(
      <ProjectCanvasStage
        projectId="project-1"
        designs={[]}
        pendingDesigns={[{ id: 'task-failed', width: 400, height: 300, status: 'failed' }]}
        onSelect={vi.fn()}
      />,
    );

    const label = screen.getByTestId('settled-label');
    expect(Number(label.dataset.fontSize)).toBeLessThan(18);
    expect(label.dataset.fontStyle).not.toBe('bold');
    userAgent.mockRestore();
  });
});

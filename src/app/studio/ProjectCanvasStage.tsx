import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import type { ProjectDesign, ProjectCanvasLayout } from '../../features/projects/metadata';
import type { TaskState } from '../../features/tasks/state';
import { getDesktopApi } from '../../platform/runtime';
import { imageFilesFromTransfer } from '../../features/assets/image-input';

export type CanvasViewport = ProjectCanvasLayout['viewport'];
export type CanvasSize = { width: number; height: number };
export type DesignDimensions = Pick<ProjectDesign, 'id' | 'width' | 'height'> & {
  sourceTaskId?: string;
  nodeId?: string;
  rowKey?: string;
  anchorId?: string;
  status?: Exclude<TaskState, 'completed'>;
  errorCode?: string;
};

const orderAnchoredDesigns = (designs: readonly DesignDimensions[]): DesignDimensions[] => {
  const anchored = new Map<string, DesignDimensions[]>();
  designs.forEach((design) => {
    if (!design.anchorId) return;
    anchored.set(design.anchorId, [...(anchored.get(design.anchorId) ?? []), design]);
  });
  return designs.flatMap((design) => design.anchorId && designs.some((candidate) => candidate.id === design.anchorId)
    ? []
    : [design, ...(anchored.get(design.id) ?? [])]);
};

const pendingStatusLabel = (design: DesignDimensions): string => {
  if (design.status === 'failed') return '处理失败';
  if (design.status === 'cancelled') return '已取消';
  if (design.status === 'unknown') return '状态未知';
  return design.status === 'queued' ? '排队中' : '处理中';
};

export const layoutProjectDesigns = (
  designs: readonly DesignDimensions[],
  options: { maxWidth?: number; gap?: number; centerRows?: boolean } = {},
): Record<string, { x: number; y: number }> => {
  const maxWidth = options.maxWidth ?? 1180;
  const gap = options.gap ?? 24;
  const positions: Record<string, { x: number; y: number }> = {};
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let rowKey: string | undefined;
  orderAnchoredDesigns(designs).forEach((design) => {
    const width = Math.max(1, design.width);
    const height = Math.max(1, design.height);
    const startsExplicitRow = design.rowKey !== undefined && design.rowKey !== rowKey;
    if (startsExplicitRow || (design.rowKey === undefined && rowKey !== undefined)) {
      if (x > 0) y += rowHeight + gap;
      x = 0;
      rowHeight = 0;
    }
    if (design.rowKey === undefined && x > 0 && x + width > maxWidth) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    rowKey = design.rowKey;
    positions[design.id] = { x, y };
    x += width + gap;
    rowHeight = Math.max(rowHeight, height);
  });
  if (options.centerRows) {
    const rows = new Map<number, { minX: number; maxX: number; ids: string[] }>();
    orderAnchoredDesigns(designs).forEach((design) => {
      const position = positions[design.id];
      if (!position) return;
      const row = rows.get(position.y) ?? { minX: position.x, maxX: position.x, ids: [] };
      row.minX = Math.min(row.minX, position.x);
      row.maxX = Math.max(row.maxX, position.x + Math.max(1, design.width));
      row.ids.push(design.id);
      rows.set(position.y, row);
    });
    rows.forEach(({ minX, maxX, ids }) => {
      const shift = Math.max(0, Math.round((maxWidth - (maxX - minX)) / 2));
      ids.forEach((id) => { positions[id]!.x += shift; });
    });
  }
  return positions;
};

const canvasGap = 24;

const sameCanvasRow = (left: DesignDimensions, right: DesignDimensions, positions: Record<string, Point>): boolean => {
  const leftPosition = positions[left.id];
  const rightPosition = positions[right.id];
  if (!leftPosition || !rightPosition) return false;
  return Math.abs(leftPosition.y - rightPosition.y) <= Math.max(canvasGap, Math.min(left.height, right.height) * 0.1);
};

/** Keep existing/manual positions and insert new results beside their source. */
export const layoutAnchoredCanvasNodes = (
  designs: readonly DesignDimensions[],
  pendingDesigns: readonly DesignDimensions[],
  currentNodes: Record<string, Point>,
): Record<string, Point> => {
  const fallback = layoutProjectDesigns(designs, { centerRows: true });
  const combinedFallback = layoutProjectDesigns([...designs, ...pendingDesigns], { centerRows: true });
  const positions: Record<string, Point> = {};
  const items = new Map<string, DesignDimensions>();
  const pendingIds = new Set(pendingDesigns.map((design) => design.id));
  designs.forEach((design) => {
    items.set(design.id, design);
    const current = (design.nodeId ? currentNodes[design.nodeId] : undefined)
      ?? currentNodes[design.id]
      ?? (design.sourceTaskId ? currentNodes[design.sourceTaskId] : undefined);
    const fallbackPosition = fallback[design.id];
    positions[design.id] = current
      ? { x: current.x, y: current.y }
      : fallbackPosition
        ? { x: fallbackPosition.x, y: fallbackPosition.y }
        : { x: 0, y: 0 };
  });
  pendingDesigns.forEach((design) => {
    items.set(design.id, design);
    const current = currentNodes[design.id];
    if (current) positions[design.id] = { x: current.x, y: current.y };
  });

  const ordered = orderAnchoredDesigns([...designs, ...pendingDesigns]);
  const insertedByAnchor = new Map<string, number>();
  ordered.forEach((item) => {
    const anchor = item.anchorId ? items.get(item.anchorId) : undefined;
    const directCurrent = currentNodes[item.id];
    const current = (item.nodeId ? currentNodes[item.nodeId] : undefined)
      ?? directCurrent
      ?? (item.sourceTaskId ? currentNodes[item.sourceTaskId] : undefined);
    const shouldRepairAnchoredRow = Boolean(anchor && directCurrent && !pendingIds.has(item.id) && !sameCanvasRow(item, anchor, positions));
    if (current && !shouldRepairAnchoredRow) return;
    delete positions[item.id];

    const anchorPosition = anchor ? positions[anchor.id] : undefined;
    if (!anchor || !anchorPosition) {
      const rowItems = item.rowKey === undefined
        ? []
        : Array.from(items.entries()).filter(([id, candidate]) => id !== item.id && candidate.rowKey === item.rowKey && positions[id]);
      if (rowItems.length > 0) {
        const rowY = positions[rowItems[0]![0]]!.y;
        const rowRight = Math.max(...rowItems.map(([id, candidate]) => positions[id]!.x + candidate.width));
        positions[item.id] = { x: rowRight + canvasGap, y: rowY };
      } else {
        positions[item.id] = combinedFallback[item.id] ?? fallback[item.id] ?? { x: 0, y: 0 };
      }
      return;
    }

    const previousWidth = insertedByAnchor.get(anchor.id) ?? 0;
    const insertionX = anchorPosition.x + anchor.width + canvasGap + previousWidth;
    const shift = item.width + canvasGap;
    Object.entries(positions).forEach(([id, position]) => {
      const candidate = items.get(id);
      if (!candidate || id === anchor.id || !sameCanvasRow(candidate, anchor, positions)) return;
      if (position.x >= insertionX) position.x += shift;
    });
    positions[item.id] = { x: insertionX, y: anchorPosition.y };
    insertedByAnchor.set(anchor.id, previousWidth + shift);
  });

  return positions;
};

export const persistedCanvasNodes = (
  designs: readonly DesignDimensions[],
  nodes: Record<string, Point>,
): Record<string, Point> => Object.fromEntries(designs.flatMap((design) => {
  const position = nodes[design.id];
  return position ? [[design.id, { x: position.x, y: position.y }]] : [];
}));

export const zoomAroundPointer = (viewport: CanvasViewport, pointer: { x: number; y: number }, nextZoom: number): CanvasViewport => {
  const zoom = Math.min(3, Math.max(0.2, nextZoom));
  const worldX = (pointer.x - viewport.offsetX) / viewport.zoom;
  const worldY = (pointer.y - viewport.offsetY) / viewport.zoom;
  return { zoom, offsetX: pointer.x - worldX * zoom, offsetY: pointer.y - worldY * zoom };
};

export const panViewport = (viewport: CanvasViewport, delta: { x: number; y: number }): CanvasViewport => ({
  ...viewport,
  offsetX: viewport.offsetX + delta.x,
  offsetY: viewport.offsetY + delta.y,
});

export const centerNodeInViewport = (
  node: { x: number; y: number; width: number; height: number },
  viewport: CanvasSize,
  zoom: number,
): CanvasViewport => ({
  zoom,
  offsetX: viewport.width / 2 - (node.x + node.width / 2) * zoom,
  offsetY: viewport.height / 2 - (node.y + node.height / 2) * zoom,
});

type ProjectCanvasStageProps = {
  libraryId?: string;
  projectId: string;
  designs: readonly ProjectDesign[];
  viewport?: CanvasViewport;
  initialNodes?: Record<string, { x: number; y: number }>;
  designRowKeys?: Record<string, string>;
  designAnchors?: Record<string, string>;
  designNodeIds?: Record<string, string>;
  selectedDesignIds?: readonly string[];
  pendingDesigns?: readonly DesignDimensions[];
  readOnly?: boolean;
  onSelect: (designId: string | null) => void;
  onAddToConversation?: (designId: string) => void;
  onCanvasBackground?: () => void;
  onLayoutChange?: (layout: Pick<ProjectCanvasLayout, 'viewport' | 'nodes'>) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
  onReady?: (size: CanvasSize) => void;
  onImportImages?: (files: readonly File[]) => void | Promise<void>;
};

type Point = { x: number; y: number };
type StageEvent = { evt: { preventDefault?: () => void; deltaY?: number }; target: { getStage?: () => { getPointerPosition?: () => Point } | undefined; getParent?: () => { className?: string }; getClassName?: () => string } };

const useAssetImages = (libraryId: string | undefined, projectId: string, designs: readonly ProjectDesign[]) => {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const load = async (): Promise<void> => {
      const next: Record<string, HTMLImageElement> = {};
      await Promise.all(designs.map(async (design) => {
        if (!libraryId) return;
        const bytes = await getDesktopApi().readAsset?.({ libraryId, projectId, assetId: design.assetId });
        if (!bytes || cancelled) return;
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
        created.push(url);
        await new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => { next[design.id] = image; resolve(); };
          image.onerror = () => resolve();
          image.src = url;
        });
      }));
      if (!cancelled) setImages(next);
      else created.forEach((url) => URL.revokeObjectURL(url));
    };
    void load();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [libraryId, projectId, designs]);
  return images;
};

export const ProjectCanvasStage = ({
  libraryId,
  projectId,
  designs,
  viewport: initialViewport,
  initialNodes,
  designRowKeys,
  designAnchors,
  designNodeIds,
  selectedDesignIds = [],
  pendingDesigns = [],
  readOnly = false,
  onSelect,
  onAddToConversation,
  onCanvasBackground,
  onLayoutChange,
  onViewportChange,
  onReady,
  onImportImages,
}: ProjectCanvasStageProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  // Konva's Stage instance is not exported as a stable React ref type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageRef = useRef<any>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 1200, height: 760 });
  const [viewport, setViewport] = useState<CanvasViewport>(initialViewport ?? { zoom: 0.65, offsetX: 40, offsetY: 40 });
  const initialLayoutDesigns = designs.map((design) => ({ ...design, nodeId: designNodeIds?.[design.id], rowKey: designRowKeys?.[design.id] ?? design.sourceTaskId, anchorId: designAnchors?.[design.id] }));
  const [nodes, setNodes] = useState<Record<string, Point>>(() => layoutAnchoredCanvasNodes(
    initialLayoutDesigns,
    pendingDesigns,
    initialNodes ?? layoutProjectDesigns(initialLayoutDesigns, { centerRows: true }),
  ));
  const [skeletonPhase, setSkeletonPhase] = useState(0);
  const dragRef = useRef<{ start: Point; viewport: CanvasViewport } | null>(null);
  const appliedInitialNodesKey = useRef<string | undefined>(undefined);
  const previousDesignCount = useRef(designs.length);
  const images = useAssetImages(libraryId, projectId, designs);
  const layoutDesigns = useMemo(() => designs.map((design) => ({ ...design, nodeId: designNodeIds?.[design.id], rowKey: designRowKeys?.[design.id] ?? design.sourceTaskId, anchorId: designAnchors?.[design.id] })), [designAnchors, designNodeIds, designRowKeys, designs]);
  const notifyLayout = useCallback((nextViewport: CanvasViewport, nextNodes: Record<string, Point>): void => {
    onViewportChange?.(nextViewport);
    onLayoutChange?.({ viewport: nextViewport, nodes: persistedCanvasNodes(layoutDesigns, nextNodes) });
  }, [layoutDesigns, onLayoutChange, onViewportChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = (): void => {
      const next = { width: Math.max(320, host.clientWidth), height: Math.max(360, host.clientHeight) };
      setSize(next);
      onReady?.(next);
    };
    update();
    window.addEventListener('resize', update);
    if (typeof ResizeObserver === 'undefined') return () => window.removeEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [onReady]);

  useEffect(() => {
    setNodes((current) => {
      const next = layoutAnchoredCanvasNodes(layoutDesigns, pendingDesigns, current);
      const ids = Object.keys(next);
      if (ids.length === Object.keys(current).length && ids.every((id) => current[id]?.x === next[id]?.x && current[id]?.y === next[id]?.y)) return current;
      return next;
    });
  }, [layoutDesigns, pendingDesigns]);

  useEffect(() => {
    if (pendingDesigns.length === 0) {
      setSkeletonPhase(0);
      return undefined;
    }
    const timer = window.setInterval(() => setSkeletonPhase((current) => (current + 1) % 24), 70);
    return () => window.clearInterval(timer);
  }, [pendingDesigns.length]);

  const displayNodes = useMemo(() => layoutAnchoredCanvasNodes(layoutDesigns, pendingDesigns, nodes), [layoutDesigns, nodes, pendingDesigns]);

  useEffect(() => {
    if (designs.length <= previousDesignCount.current || designs.length === 0) {
      previousDesignCount.current = designs.length;
      return;
    }
    const newest = designs.at(-1)!;
    const position = displayNodes[newest.id] ?? { x: 0, y: 0 };
    const host = hostRef.current;
    if (host) {
      const next = centerNodeInViewport({ ...position, width: newest.width, height: newest.height }, { width: host.clientWidth || size.width, height: host.clientHeight || size.height }, viewport.zoom);
      setViewport(next);
      notifyLayout(next, displayNodes);
    }
    previousDesignCount.current = designs.length;
  }, [designAnchors, designNodeIds, designRowKeys, designs, displayNodes, notifyLayout, size.height, size.width, viewport.zoom]);

  useEffect(() => {
    if (!initialNodes) return;
    const key = Object.entries(initialNodes).sort(([left], [right]) => left.localeCompare(right)).map(([id, point]) => `${id}:${point.x},${point.y}`).join('|');
    if (key === appliedInitialNodesKey.current) return;
    appliedInitialNodesKey.current = key;
    setNodes((current) => layoutAnchoredCanvasNodes(layoutDesigns, pendingDesigns, { ...current, ...initialNodes }));
  }, [initialNodes, layoutDesigns, pendingDesigns]);

  const skeletonOpacity = 0.14 + ((Math.sin((skeletonPhase / 24) * Math.PI * 2) + 1) / 2) * 0.16;

  const pendingStatus = (design: DesignDimensions): { fill: string; stroke: string; label: string } => {
    if (design.status === 'failed') return { fill: 'rgba(180,83,79,.10)', stroke: '#b4534f', label: '处理失败' };
    if (design.status === 'cancelled') return { fill: 'rgba(148,163,184,.18)', stroke: '#64748b', label: '已取消' };
    if (design.status === 'unknown') return { fill: 'rgba(251,191,36,.2)', stroke: '#d97706', label: '状态未知' };
    return { fill: `rgba(148,163,184,${skeletonOpacity.toFixed(3)})`, stroke: 'rgba(148,163,184,.65)', label: design.status === 'queued' ? '排队中' : '处理中' };
  };

  const handleWheel = (rawEvent: unknown): void => {
    const event = rawEvent as StageEvent;
    event.evt.preventDefault?.();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition?.() ?? { x: size.width / 2, y: size.height / 2 };
    const next = zoomAroundPointer(viewport, pointer, viewport.zoom * ((event.evt.deltaY ?? 0) > 0 ? 0.92 : 1.08));
    setViewport(next);
    notifyLayout(next, nodes);
  };

  const handlePointerDown = (rawEvent: unknown): void => {
    const event = rawEvent as StageEvent;
    const className = event.target.getClassName?.();
    if (className !== 'Stage' && className !== 'Layer') return;
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition?.() ?? { x: 0, y: 0 };
    dragRef.current = { start: pointer, viewport };
    onSelect(null);
    onCanvasBackground?.();
  };
  const handlePointerMove = (): void => {
    if (!dragRef.current) return;
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition?.() ?? dragRef.current.start;
    const next = panViewport(dragRef.current.viewport, { x: pointer.x - dragRef.current.start.x, y: pointer.y - dragRef.current.start.y });
    setViewport(next);
    onViewportChange?.(next);
  };
  const handlePointerUp = (): void => {
    if (!dragRef.current) return;
    dragRef.current = null;
    notifyLayout(viewport, nodes);
  };

  const moveDesign = (design: ProjectDesign, position: Point): void => {
    if (readOnly) return;
    const nodeId = designNodeIds?.[design.id];
    const nextNodes = { ...nodes, [design.id]: position, ...(nodeId ? { [nodeId]: position } : {}) };
    setNodes(nextNodes);
    notifyLayout(viewport, nextNodes);
  };
  const isTestCanvas = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (!readOnly) void onImportImages?.(imageFilesFromTransfer(event.dataTransfer));
  };

  return (
    <div ref={hostRef} className="project-canvas-stage" data-testid="project-canvas-stage" data-pending-design-count={pendingDesigns.length} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      {isTestCanvas ? <div aria-label="设计画布内容">
        {pendingDesigns.map((design) => <span key={`pending-${design.id}`} role="status" aria-label={`${pendingStatusLabel(design)} ${design.id}`} />)}
        {designs.map((design) => (
          <button
            type="button"
            key={design.id}
            aria-label={`设计稿 ${design.title}`}
            aria-pressed={selectedDesignIds.includes(design.id)}
            onClick={() => onSelect(design.id)}
            onDoubleClick={() => { onSelect(design.id); onAddToConversation?.(design.id); }}
          >
            {design.title}
          </button>
        ))}
      </div> : <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        x={viewport.offsetX}
        y={viewport.offsetY}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <Layer>
          {pendingDesigns.map((design) => {
            const position = displayNodes[design.id] ?? { x: 0, y: 0 };
            const status = pendingStatus(design);
            const settled = design.status === 'failed' || design.status === 'cancelled' || design.status === 'unknown';
            return <Fragment key={`pending-${design.id}`}>
              <Rect x={position.x} y={position.y} width={design.width} height={design.height} fill={status.fill} stroke={status.stroke} {...(settled ? {} : { dash: [12, 10], dashOffset: -skeletonPhase * 8 })} strokeWidth={2 / viewport.zoom} cornerRadius={8} />
              {settled && <Text
                x={position.x + 16}
                y={position.y + 16}
                width={Math.max(120, design.width - 32)}
                height={Math.max(56, design.height - 32)}
                text={status.label}
                fill={status.stroke}
                fontSize={11 / viewport.zoom}
                align="center"
                verticalAlign="middle"
              />}
            </Fragment>;
          })}
          {designs.map((design) => {
            const position = displayNodes[design.id] ?? { x: 0, y: 0 };
            const selected = selectedDesignIds.includes(design.id);
            return (
              <KonvaImage
                key={design.id}
                x={position.x}
                y={position.y}
                width={design.width}
                height={design.height}
                image={images[design.id]}
                stroke={selected ? '#2563eb' : 'rgba(15,23,42,.16)'}
                strokeWidth={(selected ? 4 : 1) / viewport.zoom}
                draggable={!readOnly}
                onClick={(event) => { event.cancelBubble = true; onSelect(design.id); }}
                onDblClick={(event) => { event.cancelBubble = true; onSelect(design.id); onAddToConversation?.(design.id); }}
                onTap={(event) => { event.cancelBubble = true; onSelect(design.id); }}
                onDragEnd={(event) => moveDesign(design, { x: event.target.x(), y: event.target.y() })}
              />
            );
          })}
        </Layer>
      </Stage>}
    </div>
  );
};

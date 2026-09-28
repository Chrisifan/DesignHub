import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';
import type { ProjectDesign, ProjectCanvasLayout } from '../../features/projects/metadata';
import { getDesktopApi } from '../../platform/runtime';

export type CanvasViewport = ProjectCanvasLayout['viewport'];
export type CanvasSize = { width: number; height: number };
export type DesignDimensions = Pick<ProjectDesign, 'id' | 'width' | 'height'> & {
  rowKey?: string;
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
  designs.forEach((design) => {
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
    designs.forEach((design) => {
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
  selectedDesignIds?: readonly string[];
  pendingDesigns?: readonly DesignDimensions[];
  readOnly?: boolean;
  onSelect: (designId: string | null) => void;
  onAddToConversation?: (designId: string) => void;
  onCanvasBackground?: () => void;
  onLayoutChange?: (layout: { viewport: CanvasViewport; nodes: Record<string, { x: number; y: number }> }) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
  onReady?: (size: CanvasSize) => void;
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
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
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
  selectedDesignIds = [],
  pendingDesigns = [],
  readOnly = false,
  onSelect,
  onAddToConversation,
  onCanvasBackground,
  onLayoutChange,
  onViewportChange,
  onReady,
}: ProjectCanvasStageProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  // Konva's Stage instance is not exported as a stable React ref type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageRef = useRef<any>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 1200, height: 760 });
  const [viewport, setViewport] = useState<CanvasViewport>(initialViewport ?? { zoom: 0.65, offsetX: 40, offsetY: 40 });
  const initialLayoutDesigns = designs.map((design) => ({ ...design, rowKey: design.sourceTaskId }));
  const [nodes, setNodes] = useState<Record<string, Point>>(() => initialNodes ?? layoutProjectDesigns(initialLayoutDesigns, { centerRows: true }));
  const [skeletonPhase, setSkeletonPhase] = useState(0);
  const dragRef = useRef<{ start: Point; viewport: CanvasViewport } | null>(null);
  const previousDesignCount = useRef(designs.length);
  const images = useAssetImages(libraryId, projectId, designs);
  const layoutDesigns = useMemo(() => designs.map((design) => ({ ...design, rowKey: design.sourceTaskId })), [designs]);
  const notifyLayout = useCallback((nextViewport: CanvasViewport, nextNodes: Record<string, Point>): void => {
    onViewportChange?.(nextViewport);
    onLayoutChange?.({ viewport: nextViewport, nodes: nextNodes });
  }, [onLayoutChange, onViewportChange]);

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
      const legacyFallback = layoutProjectDesigns(layoutDesigns);
      const fallback = layoutProjectDesigns(layoutDesigns, { centerRows: true });
      const isLegacyAutoLayout = Boolean(initialNodes)
        && designs.length > 0
        && designs.every((design) => {
          const currentPosition = current[design.id];
          const legacyPosition = legacyFallback[design.id];
          return currentPosition?.x === legacyPosition?.x && currentPosition?.y === legacyPosition?.y;
        });
      const next: Record<string, Point> = {};
      designs.forEach((design) => {
        next[design.id] = isLegacyAutoLayout
          ? fallback[design.id] ?? { x: 0, y: 0 }
          : current[design.id] ?? fallback[design.id] ?? { x: 0, y: 0 };
      });
      const rows = new Map<string, string[]>();
      layoutDesigns.forEach((design) => {
        if (!design.rowKey) return;
        rows.set(design.rowKey, [...(rows.get(design.rowKey) ?? []), design.id]);
      });
      rows.forEach((ids) => {
        if (ids.length < 2) return;
        const yValues = ids.map((id) => next[id]?.y).filter((value): value is number => value !== undefined);
        if (new Set(yValues).size < 2) return;
        ids.forEach((id) => { next[id] = fallback[id] ?? next[id]!; });
      });
      return next;
    });
  }, [designs, layoutDesigns]);

  useEffect(() => {
    if (pendingDesigns.length === 0) {
      setSkeletonPhase(0);
      return undefined;
    }
    const timer = window.setInterval(() => setSkeletonPhase((current) => (current + 1) % 24), 70);
    return () => window.clearInterval(timer);
  }, [pendingDesigns.length]);

  useEffect(() => {
    if (designs.length <= previousDesignCount.current || designs.length === 0) {
      previousDesignCount.current = designs.length;
      return;
    }
    const newest = designs.at(-1)!;
    const position = nodes[newest.id] ?? layoutProjectDesigns([{ ...newest, rowKey: newest.sourceTaskId }], { centerRows: true })[newest.id] ?? { x: 0, y: 0 };
    const host = hostRef.current;
    if (host) {
      const next = centerNodeInViewport({ ...position, width: newest.width, height: newest.height }, { width: host.clientWidth || size.width, height: host.clientHeight || size.height }, viewport.zoom);
      setViewport(next);
      notifyLayout(next, nodes);
    }
    previousDesignCount.current = designs.length;
  }, [designs, nodes, notifyLayout, size.height, size.width, viewport.zoom]);

  useEffect(() => {
    if (initialNodes) setNodes((current) => ({ ...current, ...initialNodes }));
  }, [initialNodes]);

  const pendingPositions = useMemo(() => layoutProjectDesigns([...layoutDesigns, ...pendingDesigns], { centerRows: true }), [layoutDesigns, pendingDesigns]);
  const skeletonOpacity = 0.14 + ((Math.sin((skeletonPhase / 24) * Math.PI * 2) + 1) / 2) * 0.16;

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
    const nextNodes = { ...nodes, [design.id]: position };
    setNodes(nextNodes);
    notifyLayout(viewport, nextNodes);
  };
  const isTestCanvas = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

  return (
    <div ref={hostRef} className="project-canvas-stage" data-testid="project-canvas-stage">
      {isTestCanvas ? <div aria-hidden="true" /> : <Stage
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
            const position = nodes[design.id] ?? pendingPositions[design.id] ?? { x: 0, y: 0 };
            return <Rect key={`pending-${design.id}`} x={position.x} y={position.y} width={design.width} height={design.height} fill={`rgba(148,163,184,${skeletonOpacity.toFixed(3)})`} stroke="rgba(148,163,184,.65)" dash={[12, 10]} dashOffset={-skeletonPhase * 8} strokeWidth={2 / viewport.zoom} cornerRadius={8} />;
          })}
          {designs.map((design) => {
            const position = nodes[design.id] ?? { x: 0, y: 0 };
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

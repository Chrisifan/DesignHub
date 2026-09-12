import { useId, useState, type CSSProperties, type FormEvent } from 'react';

import type { Locale } from '../i18n';
import type { Project } from './types';
import { CanvasWorkspace } from '../../features/canvas/CanvasWorkspace';
import { createScene, replaceSceneLayer, type DesignScene, type TextLayer } from '../../features/canvas/scene';
import { getDesktopApi } from '../../platform/runtime';
import { resizeScene } from '../../features/image-tools/local-transform';
import {
  ArtworkPreview,
  Badge,
  Button,
  Field,
  Icon,
  IconButton,
  t,
} from './ui';
import './workbench.css';

type LayerId = 'text' | 'shape' | 'image';
type ContextPanel = 'properties' | 'conversation' | 'history' | 'tools';
type LayerState = Record<LayerId, boolean>;

export type WorkbenchProps = {
  locale: Locale;
  project: Project;
  workspaceId?: string;
  documentId?: string;
  scene?: DesignScene;
  onBack: () => void;
  onExport: () => void;
  onConnections: () => void;
  onSubmitConversation?: (message: string) => void | Promise<void>;
  notify: (message: string) => void;
};

const createInitialScene = (project: Project): DesignScene => {
  const titleLayer = {
    id: 'title', type: 'text' as const, text: project.name, fontFamily: 'Inter', fontSize: 96,
    fontWeight: 'bold', align: 'center' as const, color: '#24262B', x: 120, y: 520,
    width: 840, height: 140, rotation: 0, opacity: 1, visible: true, locked: false,
  };
  const layers = project.artwork === 'blank'
    ? [titleLayer]
    : [
        { id: 'background', type: 'image' as const, assetId: 'placeholder', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
        titleLayer,
      ];
  return createScene({ id: `${project.id}-scene`, width: 1080, height: 1440, layers });
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const Workbench = ({
  locale,
  project,
  workspaceId,
  documentId,
  scene: providedScene,
  onBack,
  onExport,
  onConnections,
  onSubmitConversation,
  notify,
}: WorkbenchProps) => {
  const layersTitleId = useId();
  const contextTitleId = useId();
  const [selectedLayer, setSelectedLayer] = useState<LayerId>('text');
  const [visibility, setVisibility] = useState<LayerState>({
    text: true,
    shape: true,
    image: true,
  });
  const [locked, setLocked] = useState<LayerState>({
    text: false,
    shape: false,
    image: false,
  });
  const [panel, setPanel] = useState<ContextPanel | null>('properties');
  const [layersExpanded, setLayersExpanded] = useState(false);
  const [zoom, setZoom] = useState(68);
  const [gridVisible, setGridVisible] = useState(false);
  const [title, setTitle] = useState(
    locale === 'zh-CN' ? project.name : project.enName,
  );
  const [opacity, setOpacity] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [scene, setScene] = useState<DesignScene>(() => providedScene ?? createInitialScene(project));
  const [resizeWidth, setResizeWidth] = useState(() => (providedScene ?? createInitialScene(project)).width);
  const [resizeHeight, setResizeHeight] = useState(() => (providedScene ?? createInitialScene(project)).height);

  const persistScene = (nextScene: DesignScene): void => {
    setScene(nextScene);
    if (workspaceId && documentId) {
      const request = getDesktopApi().saveDocumentScene?.({ workspaceId, projectId: project.id, documentId, scene: nextScene });
      if (request) void request.catch(() => undefined);
    }
  };
  const syncTextState = (nextScene: DesignScene): void => {
    const textLayer = nextScene.layers.find((layer): layer is TextLayer => layer.type === 'text');
    if (!textLayer) return;
    setTitle(textLayer.text);
    setPosition({ x: textLayer.x, y: textLayer.y });
    setOpacity(Math.round(textLayer.opacity * 100));
  };
  const updateTextLayer = (patch: Partial<Pick<TextLayer, 'text' | 'x' | 'y' | 'opacity'>>): void => {
    const textLayer = scene.layers.find((layer): layer is TextLayer => layer.type === 'text');
    if (!textLayer || textLayer.locked) return;
    persistScene(replaceSceneLayer(scene, { ...textLayer, ...patch }));
  };

  const layerCopy: Record<
    LayerId,
    { label: string; kind: string; icon: string }
  > = {
    text: {
      label: t(locale, '标题文字', 'Title text'),
      kind: t(locale, '文字', 'Text'),
      icon: 'type',
    },
    shape: {
      label: t(locale, '装饰图形', 'Graphic shape'),
      kind: t(locale, '形状', 'Shape'),
      icon: 'square',
    },
    image: {
      label: t(locale, '背景图像', 'Background image'),
      kind: t(locale, '图像', 'Image'),
      icon: 'image',
    },
  };
  const panelCopy: Record<ContextPanel, { label: string; icon: string }> = {
    properties: {
      label: t(locale, '属性', 'Properties'),
      icon: 'sliders-horizontal',
    },
    conversation: {
      label: t(locale, '对话', 'Conversation'),
      icon: 'message-square',
    },
    history: { label: t(locale, '历史', 'History'), icon: 'history' },
    tools: { label: t(locale, '工具', 'Tools'), icon: 'wand-sparkles' },
  };
  const hasShapeLayer =
    project.artwork === 'market' || project.artwork === 'objects';
  const orderedLayers: LayerId[] = hasShapeLayer
    ? ['text', 'shape', 'image']
    : ['text', 'image'];
  const panelOrder: ContextPanel[] = [
    'properties',
    'conversation',
    'history',
    'tools',
  ];
  const canvasStyle = {
    '--workbench-zoom': zoom / 100,
    '--workbench-rotation': `${rotation}deg`,
  } as CSSProperties;

  const updateVisibility = (layer: LayerId): void => {
    setVisibility((current) => ({ ...current, [layer]: !current[layer] }));
  };
  const updateLocked = (layer: LayerId): void => {
    setLocked((current) => ({ ...current, [layer]: !current[layer] }));
  };
  const updatePosition = (axis: 'x' | 'y', rawValue: string): void => {
    const value = Number(rawValue);
    if (Number.isFinite(value)) {
      const nextValue = clamp(value, -999, 999);
      setPosition((current) => ({ ...current, [axis]: nextValue }));
      updateTextLayer({ [axis]: nextValue });
    }
  };
  const togglePanel = (nextPanel: ContextPanel): void => {
    setPanel((current) => (current === nextPanel ? null : nextPanel));
  };
  const resetZoom = (): void => {
    setZoom(68);
    notify(t(locale, '缩放已重置', 'Preview zoom reset'));
  };
  const submitPrompt = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!prompt.trim()) {
      notify(t(locale, '请输入修改说明', 'Enter an edit request'));
      return;
    }
    if (onSubmitConversation) {
      onSubmitConversation(prompt.trim());
      setPrompt('');
      return;
    }
    onConnections();
  };

  return (
    <section
      className="workbench"
      aria-label={t(locale, '设计工作台', 'Design workbench')}
    >
      <header className="workbench-toolbar">
        <div className="workbench-toolbar__document">
          <IconButton
            name="arrow-left"
            label={t(locale, '返回项目', 'Back to project')}
            onClick={onBack}
          />
          <span className="workbench-toolbar__divider" aria-hidden="true" />
          <div
            className="workbench-document-name"
            title={locale === 'zh-CN' ? project.name : project.enName}
          >
            <strong>
              {locale === 'zh-CN' ? project.name : project.enName}
            </strong>
            <span>{t(locale, '主海报', 'Main poster')}</span>
          </div>
          <Badge tone="warning">
            {t(locale, '预览未保存', 'Unsaved preview')}
          </Badge>
        </div>

        <div
          className="workbench-viewport-controls"
          role="toolbar"
          aria-label={t(locale, '预览视图', 'Preview view')}
        >
          <IconButton
            name="zoom-out"
            label={t(locale, '缩小', 'Zoom out')}
            onClick={() => setZoom((value) => clamp(value - 8, 20, 160))}
          />
          <output
            className="workbench-zoom"
            aria-label={t(locale, '预览缩放', 'Preview zoom')}
            aria-live="polite"
          >
            {zoom}%
          </output>
          <IconButton
            name="zoom-in"
            label={t(locale, '放大', 'Zoom in')}
            onClick={() => setZoom((value) => clamp(value + 8, 20, 160))}
          />
          <IconButton
            name="rotate-ccw"
            label={t(locale, '重置缩放', 'Reset zoom')}
            onClick={resetZoom}
          />
          <IconButton
            name="layout-grid"
            label={t(locale, '网格', 'Grid')}
            aria-pressed={gridVisible}
            onClick={() => setGridVisible((value) => !value)}
          />
        </div>

        <div className="workbench-toolbar__actions">
          <div
            className="workbench-panel-switcher"
            aria-label={t(locale, '上下文面板', 'Context panels')}
          >
            {panelOrder.map((panelId) => (
              <IconButton
                key={panelId}
                name={panelCopy[panelId].icon}
                label={panelCopy[panelId].label}
                aria-pressed={panel === panelId}
                onClick={() => togglePanel(panelId)}
              />
            ))}
          </div>
          <Button variant="primary" icon="download" onClick={onExport}>
            {t(locale, '导出', 'Export')}
          </Button>
        </div>
      </header>

      <div
        className={`workbench-body ${panel === null ? 'workbench-body--panel-closed' : ''}`}
      >
        <aside
          className="workbench-left"
          aria-label={t(locale, '画布工具与图层', 'Canvas tools and layers')}
        >
          <div
            className="workbench-toolstrip"
            role="toolbar"
            aria-label={t(locale, '画布工具', 'Canvas tools')}
          >
            <IconButton
              name="mouse-pointer-2"
              label={t(locale, '选择工具', 'Select tool')}
              aria-pressed="true"
              onClick={() => {
                setPanel('properties');
                setLayersExpanded(true);
              }}
            />
            <IconButton
              name="type"
              label={t(locale, '文本工具', 'Text tool')}
              onClick={() => setSelectedLayer('text')}
            />
            {hasShapeLayer && (
              <IconButton
                name="square"
                label={t(locale, '形状工具', 'Shape tool')}
                onClick={() => setSelectedLayer('shape')}
              />
            )}
            <IconButton
              name="image"
              label={t(locale, '图像工具', 'Image tool')}
              onClick={() => setSelectedLayer('image')}
            />
            <span className="workbench-toolstrip__spacer" />
            <IconButton
              name="layers"
              label={t(locale, '图层', 'Layers')}
              aria-pressed={layersExpanded}
              onClick={() => setLayersExpanded((value) => !value)}
            />
          </div>

          <section
            className={`workbench-layers ${layersExpanded ? 'workbench-layers--expanded' : ''}`}
            aria-labelledby={layersTitleId}
          >
            <div className="workbench-panel-heading">
              <div>
                <p>{t(locale, '文档', 'Document')}</p>
                <h2 id={layersTitleId}>{t(locale, '图层', 'Layers')}</h2>
              </div>
              <span className="workbench-layers__close">
                <IconButton
                  name="x"
                  label={t(locale, '关闭图层', 'Close layers')}
                  onClick={() => setLayersExpanded(false)}
                />
              </span>
            </div>
            <div className="workbench-layer-list">
              {orderedLayers.map((layerId) => {
                const item = layerCopy[layerId];
                const isVisible = visibility[layerId];
                const isLocked = locked[layerId];
                return (
                  <div
                    className={`workbench-layer-row ${selectedLayer === layerId ? 'is-selected' : ''}`}
                    key={layerId}
                  >
                    <button
                      type="button"
                      className="workbench-layer-select"
                      aria-label={item.label}
                      aria-pressed={selectedLayer === layerId}
                      onClick={() => {
                        setSelectedLayer(layerId);
                        setPanel('properties');
                      }}
                    >
                      <span className="workbench-layer-icon">
                        <Icon name={item.icon} size={15} />
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.kind}</small>
                      </span>
                    </button>
                    <IconButton
                      name={isVisible ? 'eye' : 'eye-off'}
                      label={t(
                        locale,
                        `${isVisible ? '隐藏' : '显示'}${item.label}`,
                        `${isVisible ? 'Hide' : 'Show'} ${item.label}`,
                      )}
                      aria-pressed={isVisible}
                      onClick={() => updateVisibility(layerId)}
                    />
                    <IconButton
                      name={isLocked ? 'lock' : 'unlock'}
                      label={t(
                        locale,
                        `${isLocked ? '解锁' : '锁定'}${item.label}`,
                        `${isLocked ? 'Unlock' : 'Lock'} ${item.label}`,
                      )}
                      aria-pressed={isLocked}
                      onClick={() => updateLocked(layerId)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <section
          className="workbench-canvas"
          aria-label={t(locale, '设计画布', 'Design canvas')}
          data-grid-visible={gridVisible}
          data-text-visible={visibility.text}
          data-shape-visible={visibility.shape}
          data-image-visible={visibility.image}
          style={canvasStyle}
        >
          <div className="workbench-canvas__stage">
            {workspaceId && documentId ? (
              <CanvasWorkspace
                locale={locale}
                scene={scene}
                onSceneChange={(nextScene) => { syncTextState(nextScene); setScene(nextScene); }}
                workspaceId={workspaceId}
                projectId={project.id}
                documentId={documentId}
              />
            ) : (
              <>
            <div
              className={`workbench-preview ${!visibility.text ? 'workbench-preview--text-hidden' : ''} ${!visibility.shape ? 'workbench-preview--shape-hidden' : ''} ${!visibility.image ? 'workbench-preview--image-hidden' : ''}`}
            >
              <ArtworkPreview
                kind={project.artwork}
                className="workbench-artwork"
              />
              <span
                className="workbench-artwork__title-overlay"
                style={{
                  opacity: opacity / 100,
                  transform: `translate(${position.x}px, ${position.y}px)`,
                }}
              >
                {title}
              </span>
              {selectedLayer === 'text' && visibility.text && (
                <span
                  className="workbench-selection"
                  aria-hidden="true"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                  }}
                >
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
              </>
            )}
          </div>
          <div className="workbench-canvas__meta" aria-hidden="true">
            <span>1080 × 1440 px</span>
            <span>sRGB</span>
          </div>
        </section>

        {panel !== null && (
          <aside className="workbench-context" aria-labelledby={contextTitleId}>
            <div className="workbench-panel-heading workbench-context__heading">
              <div>
                <p>{t(locale, '上下文', 'Context')}</p>
                <h2 id={contextTitleId}>{panelCopy[panel].label}</h2>
              </div>
              <IconButton
                name="x"
                label={t(locale, '关闭面板', 'Close panel')}
                onClick={() => setPanel(null)}
              />
            </div>

            {panel === 'properties' && (
              <div className="workbench-context__content workbench-properties">
                <div className="workbench-selection-summary">
                  <span className="workbench-layer-icon">
                    <Icon name={layerCopy[selectedLayer].icon} size={16} />
                  </span>
                  <div>
                    <strong>{layerCopy[selectedLayer].label}</strong>
                    <small>{layerCopy[selectedLayer].kind}</small>
                  </div>
                  <Badge>
                    {locked[selectedLayer]
                      ? t(locale, '已锁定', 'Locked')
                      : t(locale, '可编辑', 'Editable')}
                  </Badge>
                </div>

                {selectedLayer === 'text' ? (
                  <>
                    {locked.text && (
                      <div className="workbench-context-note workbench-lock-note">
                        <Icon name="lock" size={18} />
                        <div>
                          <strong>
                            {t(
                              locale,
                              '解锁图层后可继续编辑',
                              'Unlock the layer to continue editing',
                            )}
                          </strong>
                        </div>
                      </div>
                    )}
                    <Field
                      label={t(locale, '标题文字', 'Title text')}
                      hint={t(
                        locale,
                        '仅影响当前示例预览',
                        'Only affects this example preview',
                      )}
                    >
                      <input
                        aria-label={t(locale, '标题文字', 'Title text')}
                        value={title}
                        disabled={locked.text}
                        onChange={(event) => { const value = event.target.value; setTitle(value); updateTextLayer({ text: value }); }}
                      />
                    </Field>
                    <div className="workbench-property-section">
                      <h3>{t(locale, '位置', 'Position')}</h3>
                      <div className="workbench-coordinate-grid">
                        <Field label={t(locale, 'X 坐标', 'X position')}>
                          <input
                            type="number"
                            min="-999"
                            max="999"
                            value={position.x}
                            disabled={locked.text}
                            onChange={(event) =>
                              updatePosition('x', event.target.value)
                            }
                          />
                        </Field>
                        <Field label={t(locale, 'Y 坐标', 'Y position')}>
                          <input
                            type="number"
                            min="-999"
                            max="999"
                            value={position.y}
                            disabled={locked.text}
                            onChange={(event) =>
                              updatePosition('y', event.target.value)
                            }
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="workbench-property-section">
                      <div className="workbench-range-heading">
                        <h3>{t(locale, '不透明度', 'Opacity')}</h3>
                        <output>{opacity}%</output>
                      </div>
                      <input
                        className="workbench-range"
                        type="range"
                        min="0"
                        max="100"
                        value={opacity}
                        disabled={locked.text}
                        aria-label={t(locale, '不透明度', 'Opacity')}
                        onChange={(event) => { const value = Number(event.target.value); setOpacity(value); updateTextLayer({ opacity: value / 100 }); }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="workbench-context-note workbench-properties-note">
                    <Icon name="circle-alert" size={18} />
                    <div>
                      <strong>
                        {t(
                          locale,
                          '此示例仅开放文字属性',
                          'Only text properties are editable in this example',
                        )}
                      </strong>
                      <p>
                        {t(
                          locale,
                          '仍可在图层面板切换显示或锁定。',
                          'Visibility and locking remain available in the layers panel.',
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {panel === 'conversation' && (
              <div className="workbench-context__content workbench-conversation">
                <div className="workbench-context-note">
                  <Icon name="plug" size={18} />
                  <div>
                    <strong>
                      {t(locale, '尚未连接模型', 'No model connected')}
                    </strong>
                    <p>
                      {t(
                        locale,
                        '发送时将前往模型连接，输入会保留。',
                        'Sending opens model connections and keeps your draft.',
                      )}
                    </p>
                  </div>
                </div>
                <div className="workbench-conversation__scope">
                  <span>{t(locale, '目标', 'Target')}</span>
                  <strong>{t(locale, '当前文档', 'Current document')}</strong>
                </div>
                <form className="workbench-compose" onSubmit={submitPrompt}>
                  <Field label={t(locale, '修改说明', 'Edit request')}>
                    <textarea
                      rows={6}
                      value={prompt}
                      placeholder={t(
                        locale,
                        '描述希望调整的内容…',
                        'Describe the change…',
                      )}
                      onChange={(event) => setPrompt(event.target.value)}
                    />
                  </Field>
                  <div className="workbench-compose__actions">
                    <Button
                      variant="secondary"
                      icon="plug"
                      onClick={onConnections}
                    >
                      {t(locale, '连接', 'Connect')}
                    </Button>
                    <Button variant="ai" icon="arrow-up-right" type="submit">
                      {t(locale, '发送', 'Send')}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {panel === 'history' && (
              <div className="workbench-context__content workbench-history">
                <p className="workbench-section-copy">
                  {t(
                    locale,
                    '示例会话只包含初始基线。预览编辑尚未保存为版本。',
                    'This example session contains only its baseline. Preview edits are not saved as a version.',
                  )}
                </p>
                <ol className="workbench-history-list">
                  <li>
                    <span
                      className="workbench-history-marker"
                      aria-hidden="true"
                    />
                    <div>
                      <Badge>{t(locale, '示例', 'Example')}</Badge>
                      <strong>
                        {t(locale, '示例起点', 'Example baseline')}
                      </strong>
                      <p>{t(locale, '打开主海报', 'Main poster opened')}</p>
                    </div>
                  </li>
                </ol>
              </div>
            )}

            {panel === 'tools' && (
              <div className="workbench-context__content workbench-tools">
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="maximize-2" /></span>
                  <div>
                    <strong>{t(locale, '调整尺寸', 'Resize canvas')}</strong>
                    <p>{t(locale, '本地处理，可撤销或继续编辑。', 'Local transform; continue editing after apply.')}</p>
                    <div className="workbench-coordinate-grid">
                      <Field label={t(locale, '宽度', 'Width')}><input type="number" min="1" value={resizeWidth} onChange={(event) => setResizeWidth(Number(event.target.value))} /></Field>
                      <Field label={t(locale, '高度', 'Height')}><input type="number" min="1" value={resizeHeight} onChange={(event) => setResizeHeight(Number(event.target.value))} /></Field>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => {
                    try {
                      persistScene(resizeScene(scene, { width: resizeWidth, height: resizeHeight }));
                      notify(t(locale, '尺寸已更新', 'Canvas resized'));
                    } catch { notify(t(locale, '尺寸无效', 'Invalid size')); }
                  }}>{t(locale, '应用', 'Apply')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon">
                    <Icon name="rotate-ccw" />
                  </span>
                  <div>
                    <strong>
                      {t(locale, '旋转画布对象', 'Rotate canvas object')}
                    </strong>
                    <p>
                      {t(
                        locale,
                        '本地预览，不创建版本。',
                        'Local preview; no version is created.',
                      )}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRotation((value) => value - 90);
                      notify(t(locale, '已旋转预览', 'Preview rotated'));
                    }}
                  >
                    {t(locale, '旋转', 'Rotate')}
                  </Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon">
                    <Icon name="wand-sparkles" />
                  </span>
                  <div>
                    <strong>{t(locale, '智能裁切', 'Smart crop')}</strong>
                    <p>
                      {t(
                        locale,
                        '需要连接支持此功能的模型。',
                        'Connect a model that supports this tool.',
                      )}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon="plug"
                    onClick={onConnections}
                  >
                    {t(locale, '连接', 'Connect')}
                  </Button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="workbench-statusbar">
        <span>
          {t(locale, '选中', 'Selected')}: {layerCopy[selectedLayer].label}
        </span>
        <span>
          {visibility[selectedLayer]
            ? t(locale, '可见', 'Visible')
            : t(locale, '隐藏', 'Hidden')}
        </span>
        <span>{t(locale, '示例会话', 'Example session')}</span>
      </footer>
    </section>
  );
};

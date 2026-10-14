import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useEffect,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ReactNode,
} from 'react';

import type { Locale } from '../i18n';
import type { PageProps, Project, Theme, View } from './types';
import { DesignerLibrary } from './DesignerLibrary';
import { Drawer } from './Drawer';
import { PageToolbarSlot } from './PageToolbar';
import type { PersonaProfile } from './personas';
import {
  ArtworkPreview,
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  IconButton,
  PageHeader,
  Select,
  t,
  type BadgeTone,
} from './ui';
import { getDesktopApi } from '../../platform/runtime';
import type { ManagedAsset } from '../../features/assets/import-assets';
import type { DesignScene } from '../../features/canvas/scene';
import { ProviderSettings, type ProviderSettingsActions } from '../../features/providers/ProviderSettings';
import type { ProviderConnection } from '../../features/providers/connection';
import { providerCredentialAccount, providerProfiles, type ProviderConfigMap, type ProviderProfile } from '../../features/providers/config';
import { getProviderProfileStatus, mergeProviderConnectionStatus, type ProviderConnectionStatusMap } from '../../features/providers/status';
import type { DesignGenerationSlotId, TaskRecord } from '../../features/tasks/state';
import type { ExportHistoryRecord } from '../../features/delivery/export-history';
import type { TrashedProject } from '../../features/workspace/project-store';
import { shouldRunScheduledBackup, backupIntervalMs, type BackupSchedule } from '../../features/workspace/backup-schedule';
import type { WorkspaceSettings } from '../../features/workspace/settings';
import type { BatchImageTool, ImageToolJob, ImageToolItem } from '../../features/image-tools/jobs';
import { TaskResultDrawer } from './TaskResultDrawer';
import './library.css';

const ImageToolsPage = lazy(async () => {
  const module = await import('../../features/image-tools/ImageToolsPage');
  return { default: module.ImageToolsPage };
});

type LibraryPagesProps = PageProps & {
  view: Exclude<View, 'projects'>;
  theme: Theme;
  onThemeChange: (value: Theme) => void;
  onLocaleChange: (value: Locale) => void;
  deliveryProject?: Project | null;
  onUseForNew?: (personaId: string) => void;
  libraryId?: string;
  readOnly?: boolean;
  projectId?: string;
  operatorName?: string;
  onOperatorNameChange?: (name: string) => void;
  onAssetAction?: (input: { assetId: string; mode: 'place' | 'reference' | 'replace'; projectId?: string }) => void;
  preview?: boolean;
  initialAssets?: AssetItem[];
  initialProfiles?: PersonaProfile[];
  active?: boolean;
  connectionsDialogOpen?: boolean;
  onConnectionsDialogClose?: () => void;
  designerCreateRequestId?: number;
  onDesignerProfilesChange?: (profiles: PersonaProfile[]) => void;
};

type Localized = { zh: string; en: string };
type AssetType = 'all' | 'image' | 'logo' | 'texture';
type AssetItem = {
  id: string;
  name: Localized;
  type: Exclude<AssetType, 'all'>;
  typeName: Localized;
  meta: Localized;
  source: Localized;
  usage: Localized;
  artwork: 'market' | 'objects' | 'type' | 'blank';
  managed?: boolean;
};
type DeliveryFormat = 'png' | 'jpeg' | 'webp' | 'pdf';
type StorageTab = 'trash' | 'backup';
type TaskCategory = 'all' | 'queued' | 'running' | 'completed' | 'failed';
type BackupPreferences = { destinationParentDirectory: string | null; schedule: BackupSchedule; lastRunAt: string | null; lastArtifactPath: string | null };

const backupPreferencesKey = (libraryId: string): string => `designhub.backup.${libraryId}`;
const readBackupPreferences = (libraryId: string): BackupPreferences => {
  const fallback: BackupPreferences = { destinationParentDirectory: null, schedule: 'manual', lastRunAt: null, lastArtifactPath: null };
  try {
    const value = JSON.parse(localStorage.getItem(backupPreferencesKey(libraryId)) ?? '') as Partial<BackupPreferences>;
    return {
      destinationParentDirectory: typeof value.destinationParentDirectory === 'string' ? value.destinationParentDirectory : null,
      schedule: value.schedule === 'daily' || value.schedule === 'weekly' ? value.schedule : 'manual',
      lastRunAt: typeof value.lastRunAt === 'string' ? value.lastRunAt : null,
      lastArtifactPath: typeof value.lastArtifactPath === 'string' ? value.lastArtifactPath : null,
    };
  } catch { return fallback; }
};
const writeBackupPreferences = (libraryId: string, preferences: BackupPreferences): void => {
  try { localStorage.setItem(backupPreferencesKey(libraryId), JSON.stringify(preferences)); } catch { /* in-memory fallback */ }
};

const toWorkspaceSettings = (preferences: BackupPreferences): WorkspaceSettings => ({
  formatVersion: 1,
  backup: { ...preferences },
});

const persistBackupPreferences = (libraryId: string, preferences: BackupPreferences): void => {
  writeBackupPreferences(libraryId, preferences);
  void (getDesktopApi().saveWorkspaceSettings?.(libraryId, toWorkspaceSettings(preferences)) ?? Promise.resolve()).catch(() => undefined);
};

const availableConnections: readonly ProviderConnection[] = [
  { id: 'openai-compatible', label: 'OpenAI compatible', status: 'not-configured', capabilities: ['conversation', 'vision-analysis', 'image-generation', 'image-editing'] },
];

const managedAssetToItem = (asset: ManagedAsset): AssetItem => {
  const dimensions = asset.decode?.width && asset.decode?.height ? ` · ${asset.decode.width} × ${asset.decode.height}` : '';
  return {
    id: asset.id,
    name: { zh: asset.name, en: asset.name },
    type: 'image',
    typeName: { zh: asset.externalReference ? '外部引用' : '图像', en: asset.externalReference ? 'External' : 'Image' },
    meta: { zh: `${asset.format}${dimensions}`, en: `${asset.format}${dimensions}` },
    source: asset.externalReference ? { zh: '外部链接 · 未受管', en: 'External URL · unmanaged' } : { zh: '本机导入 · 受管副本', en: 'Local import · managed copy' },
    usage: { zh: '当前项目', en: 'Current project' },
    artwork: 'blank',
    managed: !asset.externalReference,
  };
};

const localize = (locale: Locale, value: Localized): string =>
  t(locale, value.zh, value.en);

const DetailRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="detail-row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

const AssetVisual = ({ item, locale, previewUrl }: { item: AssetItem; locale: Locale; previewUrl?: string }) =>
  previewUrl ? <img className="asset-image-preview" src={previewUrl} alt={localize(locale, item.name)} /> : item.type === 'logo' ? (
    <div className="asset-logo">
      <span>{t(locale, '春', 'S')}</span>
      <i />
    </div>
  ) : (
    <ArtworkPreview kind={item.artwork} className="asset-artwork" />
  );

const AssetsPage = ({
  locale,
  query,
  type,
  layout,
  selectedId,
  onQueryChange,
  onTypeChange,
  onLayoutChange,
  onSelect,
  libraryId,
  projectId,
  readOnly,
  notify,
  onAssetAction,
  active,
  preview = false,
  initialAssets = [],
}: {
  locale: Locale;
  query: string;
  type: AssetType;
  layout: 'grid' | 'list';
  selectedId: string;
  onQueryChange: (value: string) => void;
  onTypeChange: (value: AssetType) => void;
  onLayoutChange: (value: 'grid' | 'list') => void;
  onSelect: (value: string) => void;
  libraryId?: string;
  projectId?: string;
  readOnly?: boolean;
  notify?: (message: string) => void;
  onAssetAction?: (input: { assetId: string; mode: 'place' | 'reference' | 'replace'; projectId?: string }) => void;
  active: boolean;
  preview?: boolean;
  initialAssets?: AssetItem[];
}) => {
  const [managedAssets, setManagedAssets] = useState<ManagedAsset[]>([]);
  const [assetsLoadFailed, setAssetsLoadFailed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputId = 'asset-import-input';
  const readFile = async (file: File): Promise<ArrayBuffer> => {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Response(file).arrayBuffer();
  };
  useEffect(() => {
    if (!libraryId || !projectId) { setManagedAssets([]); setAssetsLoadFailed(false); return undefined; }
    let cancelled = false;
    setManagedAssets([]);
    setAssetsLoadFailed(false);
    const request = getDesktopApi().listAssets?.({ libraryId, projectId });
    if (!request) { setAssetsLoadFailed(true); return () => { cancelled = true; }; }
    void request?.then((result) => {
      if (!cancelled && result) {
        const hiddenPurposes = new Set(['conversation-reference', 'project-cover']);
        setManagedAssets(result.filter((asset) => !hiddenPurposes.has(String(asset.metadata?.purpose ?? ''))));
      }
    }).catch(() => { if (!cancelled) { setAssetsLoadFailed(true); notify?.(t(locale, '素材读取失败', 'Could not load assets')); } });
    return () => { cancelled = true; };
  }, [locale, notify, projectId, libraryId]);
  const importFiles = async (files: FileList | File[] | null): Promise<void> => {
    if (!files || !libraryId || !projectId || readOnly) return;
    setImporting(true);
    try {
      const items = await Promise.all(Array.from(files).map(async (file) => ({ name: file.name, mimeType: file.type || undefined, data: await readFile(file) })));
      const results = await getDesktopApi().importAssets?.({ libraryId, projectId, items });
      if (results) {
        const imported = results.filter((result): result is Extract<typeof result, { status: 'success' }> => result.status === 'success').map((result) => result.asset);
        if (imported.length) setManagedAssets((current) => [...current, ...imported.filter((asset) => !current.some((entry) => entry.id === asset.id))]);
        const failed = results.filter((result) => result.status === 'error').length;
        notify?.(failed ? t(locale, `${imported.length} 项已导入，${failed} 项失败`, `${imported.length} imported, ${failed} failed`) : t(locale, `${imported.length} 项已导入`, `${imported.length} imported`));
      }
    } catch {
      notify?.(t(locale, '素材导入失败', 'Could not import assets'));
    } finally { setImporting(false); }
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    void importFiles(event.dataTransfer.files);
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>): void => {
    const files = Array.from(event.clipboardData.files);
    if (!files.length) return;
    event.preventDefault();
    void importFiles(files.map((file) => {
      if (file.name) return file;
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1] || 'png';
      return new File([file], `clipboard.${extension}`, { type: file.type || 'image/png' });
    }));
  };
  const usingManagedAssets = Boolean(libraryId && projectId);
  const displayAssets = libraryId ? (usingManagedAssets ? managedAssets.map(managedAssetToItem) : []) : preview ? initialAssets : [];
  const filteredAssets = useMemo(
    () =>
      displayAssets.filter(
        (item) =>
          (type === 'all' || item.type === type) &&
          localize(locale, item.name)
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      ),
    [displayAssets, locale, query, type],
  );
  const selected = displayAssets.find((item) => item.id === selectedId) ?? displayAssets[0];
  const assetTypes: readonly { value: AssetType; label: string }[] = [
    { value: 'all', label: t(locale, '全部', 'All') },
    { value: 'image', label: t(locale, '图像', 'Images') },
    { value: 'logo', label: t(locale, '标志', 'Logos') },
    { value: 'texture', label: t(locale, '纹理', 'Textures') },
  ];
  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(undefined);
    if (!selected || !libraryId || !projectId || selected.managed === false) return () => { cancelled = true; };
    const request = getDesktopApi().readAsset?.({ libraryId, projectId, assetId: selected.id });
    void request?.then((bytes) => {
      if (!bytes || cancelled || typeof URL === 'undefined') return;
      const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/*' }));
      setPreviewUrl(url);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId, selected?.id, selected?.managed, libraryId]);
  return (
    <section className="page-content library-page">
      <PageHeader
        title={t(locale, '素材库', 'Assets')}
        eyebrow={t(locale, '受管素材', 'Managed assets')}
        description={t(
          locale,
          libraryId ? (usingManagedAssets ? '浏览当前项目素材的来源、格式、用途与受管状态。' : '选择项目后可浏览其受管素材。') : preview ? '浏览示例素材的来源、格式、用途与受管状态。' : '导入素材后会显示在这里。',
          libraryId ? (usingManagedAssets ? 'Browse source, format, usage and managed state for this project.' : 'Select a project to browse its managed assets.') : preview ? 'Browse source, format, usage and managed state for example assets.' : 'Import assets to see them here.',
        )}
      />
      <PageToolbarSlot active={active}>
        <div className="toolbar-segmented" role="group" aria-label={t(locale, '类型', 'Type')}>
          {assetTypes.map((option) => (
            <button
              type="button"
              key={option.value}
              className={type === option.value ? 'is-active' : ''}
              aria-pressed={type === option.value}
              onClick={() => onTypeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="toolbar-search">
          <Icon name="search" size={16} />
          <span className="sr-only">
            {t(locale, '搜索素材', 'Search assets')}
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t(locale, '搜索名称', 'Search by name')}
          />
        </label>
        <div
          className="view-toggle"
          role="group"
          aria-label={t(locale, '视图', 'View')}
        >
          <IconButton
            name="layout-grid"
            label={t(locale, '网格', 'Grid')}
            aria-pressed={layout === 'grid'}
            onClick={() => onLayoutChange('grid')}
          />
          <IconButton
            name="list"
            label={t(locale, '列表', 'List')}
            aria-pressed={layout === 'list'}
            onClick={() => onLayoutChange('list')}
          />
        </div>
        {usingManagedAssets && <>
          <input id={inputId} type="file" multiple hidden onChange={(event) => { void importFiles(event.target.files); event.currentTarget.value = ''; }} />
          <IconButton name="upload" label={importing ? t(locale, '导入中', 'Importing') : t(locale, '导入', 'Import')} disabled={readOnly || importing} onClick={() => document.getElementById(inputId)?.click()} />
        </>}
      </PageToolbarSlot>
      <p className="asset-result-count">
        {filteredAssets.length} {t(locale, '项', 'items')}
      </p>
      <div
        className="library-split"
        aria-label={t(locale, '素材导入区域', 'Asset import area')}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
      >
        <div className={`asset-collection asset-collection--${layout} ${!assetsLoadFailed && filteredAssets.length === 0 ? 'asset-collection--empty' : ''}`}>
      {assetsLoadFailed ? <div className="details-panel asset-details"><EmptyState icon="alert-triangle" title={t(locale, '素材读取失败', 'Could not load assets')} description={t(locale, '请检查工作区权限后重新进入此页面。', 'Check workspace permissions and reopen this page.')} /></div> : filteredAssets.length ? (
            filteredAssets.map((item) => (
              <button
                type="button"
                className={`asset-card ${selected.id === item.id ? 'is-selected' : ''}`}
                key={item.id}
                onClick={() => { onSelect(item.id); setDrawerOpen(true); }}
                aria-pressed={selected.id === item.id}
                aria-label={`${localize(locale, item.name)} · ${localize(locale, item.meta)}`}
              >
                <AssetVisual item={item} locale={locale} />
                <span className="asset-card-copy">
                  <strong>{localize(locale, item.name)}</strong>
                  <small>{localize(locale, item.meta)}</small>
                </span>
                <Badge>{localize(locale, item.typeName)}</Badge>
              </button>
            ))
          ) : displayAssets.length ? (
            <div className="page-empty-state">
              <EmptyState
                icon="search"
                title={t(locale, '没有匹配素材', 'No matching assets')}
                description={t(
                  locale,
                  '调整名称或类型筛选。',
                  'Change the name or type filter.',
                )}
              />
            </div>
          ) : (
            <div className="page-empty-state">
              <EmptyState
                icon="image"
                title={t(locale, '暂无素材', 'No assets yet')}
                description={t(locale, '导入素材后会显示在这里。', 'Import assets to see them here.')}
              />
            </div>
          )}
        </div>
        {assetsLoadFailed ? null : selected && <Drawer
          open={drawerOpen}
          title={t(locale, '素材详情', 'Asset details')}
          locale={locale}
          onClose={() => setDrawerOpen(false)}
          footer={usingManagedAssets && selected.managed !== false && onAssetAction ? (
            <div className="asset-detail-actions" role="group" aria-label={t(locale, '素材操作', 'Asset actions')}>
              <Button icon="image" onClick={() => onAssetAction({ assetId: selected.id, mode: 'place', projectId })}>{t(locale, '放入画布', 'Place on canvas')}</Button>
              <Button icon="eye" onClick={() => onAssetAction({ assetId: selected.id, mode: 'reference', projectId })}>{t(locale, '作为参考', 'Use as reference')}</Button>
              <Button icon="rotate-ccw" onClick={() => onAssetAction({ assetId: selected.id, mode: 'replace', projectId })}>{t(locale, '替换选中图像', 'Replace selected image')}</Button>
            </div>
          ) : undefined}
        ><div
          className="details-panel asset-details"
        >
          <div className="asset-detail-visual">
            <AssetVisual item={selected} locale={locale} previewUrl={previewUrl} />
          </div>
          <p className="section-kicker">
            {localize(locale, selected.typeName)}
          </p>
          <h2>{localize(locale, selected.name)}</h2>
          <dl className="details-list">
            <DetailRow label={t(locale, '格式', 'Format')}>
              {localize(locale, selected.meta)}
            </DetailRow>
            <DetailRow label={t(locale, '来源', 'Source')}>
              {localize(locale, selected.source)}
            </DetailRow>
            <DetailRow label={t(locale, '用途', 'Usage')}>
              {localize(locale, selected.usage)}
            </DetailRow>
            <DetailRow label={t(locale, '状态', 'Status')}>
              <Badge tone={selected.managed === false ? 'warning' : 'success'}>
                {selected.managed === false ? t(locale, '外部引用', 'External reference') : t(locale, '受管副本', 'Managed copy')}
              </Badge>
            </DetailRow>
          </dl>
          {!libraryId && preview && <p className="panel-note">
            <Icon name="lock" size={15} />
            {t(
              locale,
              '此页只浏览示例元数据，不读取或写入本机文件。',
              'This page only browses example metadata and does not read or write local files.',
            )}
          </p>}
        </div></Drawer>}
      </div>
    </section>
  );
};

const ConnectionsPage = ({
  locale,
  libraryId,
  dialogOpen,
  onDialogClose,
}: Pick<PageProps, 'locale'> & { libraryId?: string; dialogOpen?: boolean; onDialogClose?: () => void }) => {
  const [connectionState, setConnectionState] = useState<Record<string, boolean>>({});
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigMap>({});
  const [providerStatuses, setProviderStatuses] = useState<ProviderConnectionStatusMap>({});
  const [providerActions, setProviderActions] = useState<ProviderSettingsActions | null>(null);
  const [activeProfile, setActiveProfile] = useState<ProviderProfile>('conversation');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const statusAware = Boolean(getDesktopApi().loadProviderConnectionStatuses);
  const isDialogOpen = dialogOpen ?? drawerOpen;
  const openDialog = (profile: ProviderProfile) => {
    setActiveProfile(profile);
    if (onDialogClose) return;
    setDrawerOpen(true);
  };
  const closeDialog = () => {
    if (onDialogClose) onDialogClose();
    else setDrawerOpen(false);
  };
  const checkCredential = useCallback(
    async (connectionId: string) => getDesktopApi().hasCredential?.(connectionId) ?? false,
    [],
  );
  useEffect(() => {
    let cancelled = false;
    const checks = availableConnections.flatMap((connection) => providerProfiles.map(async (profile) => {
      const account = providerCredentialAccount(connection.id, profile);
      return [account, await getDesktopApi().hasCredential?.(account) ?? false] as const;
    }));
    void Promise.all([
      Promise.all(checks),
      getDesktopApi().loadProviderConfigs?.() ?? Promise.resolve(null),
      getDesktopApi().loadProviderConnectionStatuses?.() ?? Promise.resolve(null),
    ]).then(([entries, configs, statuses]) => {
      if (cancelled) return;
      setConnectionState(Object.fromEntries(entries));
      setProviderConfigs(configs ?? {});
      setProviderStatuses(statuses ?? {});
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const connections = availableConnections.map((connection) => {
    const profileStatuses = Object.fromEntries(providerProfiles.map((profile) => [
      profile,
      statusAware
        ? getProviderProfileStatus(providerStatuses, connection.id as 'openai-compatible', profile, providerConfigs)
        : connectionState[providerCredentialAccount(connection.id, profile)] ? 'connected' : 'unknown',
    ])) as Record<ProviderProfile, ReturnType<typeof getProviderProfileStatus>>;
    const connected = providerProfiles.some((profile) => connectionState[providerCredentialAccount(connection.id, profile)] && profileStatuses[profile] === 'connected');
    const failed = providerProfiles.some((profile) => connectionState[providerCredentialAccount(connection.id, profile)] && profileStatuses[profile] === 'error');
    return { ...connection, profileStatuses, status: connected ? 'connected' as const : failed ? 'error' as const : 'not-configured' as const };
  });
  const hasConnected = connections.some((connection) => connection.status === 'connected');
  const hasFailure = connections.some((connection) => connection.status === 'error');
  const recordProviderStatus = async (profile: ProviderProfile, status: 'connected' | 'error'): Promise<void> => {
    const next = mergeProviderConnectionStatus(providerStatuses, 'openai-compatible', profile, status, providerConfigs);
    setProviderStatuses(next);
    await (getDesktopApi().saveProviderConnectionStatuses?.(next) ?? Promise.resolve(false)).catch(() => undefined);
  };
  const profileRows: readonly { profile: ProviderProfile; icon: string; label: string }[] = [
    { profile: 'conversation', icon: 'message-square', label: t(locale, '对话与视觉', 'Conversation and vision') },
    { profile: 'image', icon: 'image', label: t(locale, '图片生成与编辑', 'Image generation and editing') },
  ];
  return (
  <section className="page-content library-page">
    <PageHeader
      title={t(locale, '模型连接', 'Model connections')}
      eyebrow={t(locale, '本机能力', 'Local capability')}
      description={!libraryId ? t(
        locale,
        '连接由本机适配器提供；项目与密钥不会进入示例数据。',
        'Connections are provided by local adapters; projects and keys never enter example data.',
      ) : ''}
    />
    <div className="connection-layout connection-layout--status-first">
      <div className="page-empty-state">
        <EmptyState
          icon="plug"
          title={hasConnected ? t(locale, '模型已连接', 'Models connected') : hasFailure ? t(locale, '模型连接失败', 'Model connection failed') : t(locale, '尚未连接模型', 'No models connected')}
          description={hasConnected
            ? t(locale, '启动自检已验证模型连接可用。', 'Startup checks verified that the model connection is available.')
            : hasFailure
              ? t(locale, '最近一次连接测试失败，请检查地址、密钥和模型。', 'The latest connection test failed. Check the URL, key and model.')
            : !libraryId ? t(
              locale,
              '当前仍可浏览示例、编辑画布与配置导出。连接模型后即可提交真实任务。',
              'You can still browse the example, edit the canvas and configure delivery. Connect a model to submit real tasks.',
            ) : ''}
        />
      </div>
      <Drawer
        open={isDialogOpen}
        title={t(locale, '连接配置', 'Connection configuration')}
        className="provider-connection-dialog"
        locale={locale}
        onClose={closeDialog}
        footer={providerActions ? (
          <div className="provider-profile-actions-row provider-profile-actions-row--compact">
            {providerActions.showTestConversation && <Button type="button" variant="ai" icon="plug" disabled={providerActions.testBusy || !providerActions.canTestConversation} onClick={providerActions.testConversation}>{providerActions.testBusy ? t(locale, '测试中…', 'Testing…') : t(locale, '测试连接', 'Test connection')}</Button>}
            {providerActions.showTestImage && <Button type="button" variant="ai" icon="image" disabled={providerActions.testBusy || !providerActions.canTestImage} onClick={providerActions.testImageGeneration}>{providerActions.testBusy ? t(locale, '测试中…', 'Testing…') : t(locale, '测试生成', 'Test generation')}</Button>}
            {providerActions.canSaveConfig && <Button type="button" variant="secondary" icon="save" onClick={providerActions.saveConfig}>{t(locale, '保存配置', 'Save config')}</Button>}
          </div>
        ) : undefined}
      >
        <div className="connection-dialog-content">
          <div className="connection-profile-switcher" role="group" aria-label={t(locale, '配置类别', 'Configuration group')}>
            {profileRows.map(({ profile, icon, label }) => {
              return (
                <button
                  type="button"
                  className={`connection-profile-switcher__button${activeProfile === profile ? ' is-selected' : ''}`}
                  key={profile}
                  aria-pressed={activeProfile === profile}
                  onClick={() => setActiveProfile(profile)}
                >
                  <Icon name={icon} size={17} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <ProviderSettings
            locale={locale}
            connections={connections}
            configs={providerConfigs}
            activeProfile={activeProfile}
            onActionsChange={setProviderActions}
            onActiveProfileChange={openDialog}
            onSaveProviderConfig={async (connectionId, config) => {
              const saved = await (getDesktopApi().saveProviderConfig?.({ connectionId: connectionId as 'openai-compatible', config }) ?? false);
              if (saved) setProviderConfigs((current) => ({ ...current, [connectionId]: config }));
              return saved;
            }}
            onTestConversation={libraryId ? async (connectionId, input) => {
              try {
                const result = await (getDesktopApi().testConversation?.({ libraryId, connectionId, ...input }) ?? null);
                if (!result) throw new Error('CONVERSATION_TEST_FAILED');
                await recordProviderStatus('conversation', 'connected');
                return result;
              } catch (error) {
                await recordProviderStatus('conversation', 'error');
                throw error;
              }
            } : undefined}
            onTestImageGeneration={libraryId ? async (connectionId, input) => {
              try {
                const result = await (getDesktopApi().testImageGeneration?.({ libraryId, connectionId, ...input }) ?? null);
                if (!result?.image) throw new Error('IMAGE_TEST_FAILED');
                await recordProviderStatus('image', 'connected');
                return result;
              } catch (error) {
                await recordProviderStatus('image', 'error');
                throw error;
              }
            } : undefined}
            onCheckCredential={checkCredential}
            onStoreCredential={async (connectionId, secret) => {
              const stored = await (getDesktopApi().storeCredential?.(connectionId, secret) ?? false);
              if (stored) setConnectionState((current) => ({ ...current, [connectionId]: true }));
              return stored;
            }}
            onDeleteCredential={async (connectionId) => {
              const deleted = await (getDesktopApi().deleteCredential?.(connectionId) ?? false);
              if (deleted) setConnectionState((current) => ({ ...current, [connectionId]: false }));
              return deleted;
            }}
          />
        </div>
      </Drawer>
      <div className="capability-matrix">
        <div className="matrix-heading">
          <span>{t(locale, '配置类别', 'Configuration group')}</span>
          <span>{t(locale, '连接状态', 'Connection state')}</span>
        </div>
        {profileRows.map(({ profile, icon, label }) => {
          const profileStatus = connections[0]?.profileStatuses?.[profile] ?? 'unknown';
          const connected = profileStatus === 'connected'
            && Boolean(connectionState[providerCredentialAccount('openai-compatible', profile)]);
          const failed = profileStatus === 'error'
            && Boolean(connectionState[providerCredentialAccount('openai-compatible', profile)]);
          return (
            <button
              type="button"
              className={`matrix-row matrix-profile-button ${activeProfile === profile ? 'is-selected' : ''}`}
              key={profile}
              aria-label={label}
              aria-pressed={activeProfile === profile}
              onClick={() => openDialog(profile)}
            >
              <span>
                <Icon name={icon} size={17} />
                {label}
              </span>
              <Badge tone={connected ? 'success' : failed ? 'error' : ''}>{connected ? t(locale, '已连接', 'Connected') : failed ? t(locale, '连接失败', 'Connection failed') : t(locale, '未配置', 'Not configured')}</Badge>
            </button>
          );
        })}
      </div>
    </div>
    {!libraryId && <p className="page-footnote">
      <Icon name="lock" size={15} />
      {t(
        locale,
        '此页面不收集密钥，也不会伪装连接检测。状态只显示本机安全存储中的配置结果。',
        'This page does not collect keys or simulate checks. Status reflects configuration in local secure storage.',
      )}
    </p>}
  </section>
  );
};

const TasksPage = ({
  locale,
  navigate,
  libraryId,
  active,
}: Pick<PageProps, 'locale' | 'navigate'> & { libraryId?: string; active: boolean }) => {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [category, setCategory] = useState<TaskCategory>('all');
  const [selectedResultTaskId, setSelectedResultTaskId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let loading = false;
    setLoadFailed(false);
    if (!libraryId || !active) {
      setTasks([]);
      return () => { cancelled = true; };
    }
    const load = async (): Promise<void> => {
      if (loading) return;
      loading = true;
      try {
        const stored = await getDesktopApi().listTasks?.(libraryId);
        if (cancelled) return;
        if (!stored) {
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        setTasks(stored);
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, libraryId]);
  const matchesCategory = (task: TaskRecord, value: TaskCategory): boolean => {
    if (value === 'all') return true;
    if (value === 'failed') return task.state === 'failed' || task.state === 'cancelled' || task.errorCode === 'RESULT_UNKNOWN_AFTER_RESTART';
    return task.state === value;
  };
  const taskCategories: Array<{ value: TaskCategory; label: string }> = [
    { value: 'all', label: t(locale, '全部', 'All') },
    { value: 'queued', label: t(locale, '排队', 'Queued') },
    { value: 'running', label: t(locale, '处理中', 'Running') },
    { value: 'completed', label: t(locale, '已完成', 'Completed') },
    { value: 'failed', label: t(locale, '失败', 'Failed') },
  ];
  const taskCounts = taskCategories.reduce<Record<TaskCategory, number>>((counts, option) => {
    counts[option.value] = tasks.filter((task) => matchesCategory(task, option.value)).length;
    return counts;
  }, { all: 0, queued: 0, running: 0, completed: 0, failed: 0 });
  const taskTimestamp = (task: TaskRecord): number => {
    const value = task.updatedAt ?? task.createdAt;
    if (!value) return Number.NEGATIVE_INFINITY;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
  };
  const visibleTasks = tasks
    .filter((task) => matchesCategory(task, category))
    .sort((left, right) => taskTimestamp(right) - taskTimestamp(left) || right.id.localeCompare(left.id));
  const taskTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }), [locale]);
  const taskTimeTitleFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'long',
  }), [locale]);
  const taskTime = (task: TaskRecord): { label: string; title?: string } => {
    const timestamp = taskTimestamp(task);
    if (!Number.isFinite(timestamp)) return { label: '—' };
    const date = new Date(timestamp);
    return {
      label: taskTimeFormatter.format(date),
      title: taskTimeTitleFormatter.format(date),
    };
  };
  const stopTask = async (taskId: string): Promise<void> => {
    if (!libraryId) return;
    const stopped = await getDesktopApi().cancelTask?.(libraryId, taskId);
    if (!stopped) return;
    setTasks((current) => current.map((task) => task.id === taskId
      ? { ...task, state: 'cancelled', cancelRequested: true, updatedAt: new Date().toISOString() }
      : task));
  };
  const retryTask = async (taskId: string): Promise<void> => {
    if (!libraryId) return;
    const retried = await getDesktopApi().retryTask?.(libraryId, taskId);
    if (!retried) return;
    setTasks((current) => [...current, retried]);
  };
  const retryGenerationSlot = async (taskId: string, slotId: DesignGenerationSlotId): Promise<void> => {
    if (!libraryId) return;
    const retried = await getDesktopApi().retryDesignGenerationSlot?.({ libraryId, taskId, slotId });
    if (!retried) return;
    setTasks((current) => current.map((task) => task.id === taskId ? retried : task));
  };
  const generationProgress = (task: TaskRecord): string | undefined => {
    if (!task.generationSlots?.length) return undefined;
    const completed = task.generationSlots.filter((slot) => slot.state === 'completed').length;
    return t(locale, `候选 ${completed}/${task.generationSlots.length}`, `Candidates ${completed}/${task.generationSlots.length}`);
  };
  const taskCapabilityLabel = (task: TaskRecord): string => ({
    conversation: t(locale, '对话', 'Conversation'),
    'design-generation': t(locale, '设计生成', 'Design generation'),
    'image-generation': t(locale, '图片生成', 'Image generation'),
    'image-editing': t(locale, '图片编辑', 'Image editing'),
    'local-transform': t(locale, '本地转换', 'Local transform'),
    'vision-analysis': t(locale, '作品集分析', 'Portfolio analysis'),
  })[task.capability ?? ''] ?? task.capability ?? t(locale, '模型任务', 'Model task');
  const failureDescription = (task: TaskRecord): string | undefined => {
    const failure = task.providerFailure;
    if (!failure) return undefined;
    const details = [
      failure.status === undefined ? undefined : `HTTP ${failure.status}`,
      failure.providerCode,
    ].filter((value): value is string => Boolean(value)).join('，');
    const suffix = details ? `（${details}）` : '';
    if (failure.kind === 'rate_limited') {
      return t(locale, `服务请求受限${suffix}${failure.retryAfterSeconds === undefined ? '' : `，${failure.retryAfterSeconds} 秒后可重试`}`, `Provider rate limit${failure.status === undefined ? '' : ` (HTTP ${failure.status})`}${failure.retryAfterSeconds === undefined ? '' : `; retry in ${failure.retryAfterSeconds}s`}`);
    }
    if (failure.kind === 'invalid_response') return t(locale, `服务返回了无法解析的结果${suffix}`, `Provider returned an unreadable result${failure.status === undefined ? '' : ` (HTTP ${failure.status})`}`);
    if (failure.kind === 'cancelled') return t(locale, '服务请求已取消', 'Provider request was cancelled');
    return t(locale, `服务请求被拒绝${suffix}`, `Provider request was rejected${failure.status === undefined ? '' : ` (HTTP ${failure.status})`}`);
  };
  const taskStateLabel = (task: TaskRecord): string => task.state === 'queued'
    ? t(locale, '排队', 'Queued')
    : task.state === 'running'
      ? t(locale, '处理中', 'Running')
      : task.state === 'completed'
        ? t(locale, '已完成', 'Completed')
        : task.state === 'cancelled'
          ? t(locale, '已取消', 'Cancelled')
          : task.errorCode === 'RESULT_UNKNOWN_AFTER_RESTART'
            ? t(locale, '结果未知', 'Result unknown')
            : t(locale, '失败', 'Failed');
  const taskTone = (task: TaskRecord): BadgeTone => task.errorCode === 'RESULT_UNKNOWN_AFTER_RESTART'
    ? 'warning'
    : task.state === 'failed'
      ? 'error'
      : task.state === 'cancelled'
        ? 'warning'
        : task.state === 'completed'
          ? 'success'
          : '';
  const taskSummary = (task: TaskRecord): string => {
    const guidance = task.state === 'failed' || task.state === 'cancelled'
      ? task.capability === 'vision-analysis'
        ? t(locale, '请重新选择作品集来源', 'Select portfolio sources again')
        : task.capability === 'image-editing' && (!task.sourceAssetId || task.hasMask !== false || task.region)
          ? t(locale, '请重新选择原图', 'Select the source image again')
          : undefined
      : undefined;
    return [task.requestText, failureDescription(task), guidance].filter(Boolean).join(' · ')
      || task.source?.id
      || task.requestId
      || t(locale, '模型任务', 'Model task');
  };
  const taskResult = (task: TaskRecord): { label: string; title: string; inspectable: boolean } => {
    const progress = generationProgress(task);
    const candidateCount = task.result?.candidates?.length ?? (task.result?.candidate ? 1 : 0);
    const candidateSummary = progress || candidateCount === 0
      ? undefined
      : t(locale, `候选 ${candidateCount}`, `${candidateCount} ${candidateCount === 1 ? 'candidate' : 'candidates'}`);
    const resultAssetCount = new Set([
      ...(task.result?.assetIds ?? []),
      task.result?.sceneAssetId,
      task.result?.toolCandidate?.resultAssetId,
    ].filter((assetId): assetId is string => Boolean(assetId))).size;
    const resolvedImageCount = task.result?.imageCount ?? (candidateCount === 0 && resultAssetCount > 0 ? resultAssetCount : undefined);
    const imageCount = resolvedImageCount === undefined
      ? undefined
      : t(locale, `${resolvedImageCount} 张图`, `${resolvedImageCount} images`);
    const cost = task.result?.cost === undefined || task.result.cost === null
      ? undefined
      : t(locale, `费用 ${task.result.cost.toFixed(2)}`, `Cost ${task.result.cost.toFixed(2)}`);
    const details = [progress, candidateSummary, imageCount, cost].filter((value): value is string => Boolean(value));
    return {
      label: progress ?? candidateSummary ?? imageCount ?? cost ?? '—',
      title: details.join(' · ') || '—',
      inspectable: Boolean(
        task.generationSlots?.length
        || task.result?.candidate
        || task.result?.candidates?.length
        || task.result?.assetIds?.length
        || task.result?.sceneAssetId
        || task.result?.toolCandidate?.resultAssetId
      ),
    };
  };
  const selectedResultTask = selectedResultTaskId
    ? tasks.find((task) => task.id === selectedResultTaskId) ?? null
    : null;
  return <section className="page-content library-page">
    <PageHeader
      title={t(locale, '模型任务', 'Model tasks')}
      eyebrow={t(locale, '运行记录', 'Run history')}
      description={t(
        locale,
        '查看由项目或草稿提交的模型计算任务。',
        'Review model compute tasks submitted by projects or drafts.',
      )}
    />
    <PageToolbarSlot active={active}>
      <div className="toolbar-segmented" role="group" aria-label={t(locale, '任务状态', 'Task status')}>
        {taskCategories.map((option) => (
          <button type="button" key={option.value} className={category === option.value ? 'is-active' : ''} aria-pressed={category === option.value} onClick={() => setCategory(option.value)}>
            {option.label}<span>{taskCounts[option.value]}</span>
          </button>
        ))}
      </div>
    </PageToolbarSlot>
    {loadFailed ? <div className="page-empty-state"><EmptyState
      icon="circle-alert"
      title={t(locale, '任务读取失败', 'Could not load tasks')}
      description={t(locale, '请重试，原有任务不会被覆盖。', 'Retry without overwriting existing task records.')}
    /></div> : tasks.length > 0 && visibleTasks.length > 0 ? <div className="task-list" role="list" aria-label={t(locale, '任务列表', 'Task list')}>
      <div className="task-row task-row--header" role="listitem" aria-label={t(locale, '表头', 'Header')}>
        <span className="task-row__cell task-row__type">{t(locale, '任务类型', 'Task type')}</span>
        <span className="task-row__cell task-row__state">{t(locale, '状态', 'Status')}</span>
        <span className="task-row__cell task-row__summary">{t(locale, '任务摘要', 'Task summary')}</span>
        <span className="task-row__cell task-row__result">{t(locale, '结果', 'Result')}</span>
        <span className="task-row__cell task-row__time">{t(locale, '时间', 'Time')}</span>
        <span className="task-row__actions">{t(locale, '操作', 'Actions')}</span>
      </div>
      {visibleTasks.map((task) => {
        const summary = taskSummary(task);
        const result = taskResult(task);
        const time = taskTime(task);
        const canRetry = !task.generationSlots?.length && (task.state === 'failed' || task.state === 'cancelled') && task.capability !== 'vision-analysis' && !(task.capability === 'image-editing' && (!task.sourceAssetId || task.hasMask !== false || task.region));
        const capabilityLabel = taskCapabilityLabel(task);
        return <article className="task-row" aria-label={task.id} key={task.id}>
          <strong className="task-row__cell task-row__type" title={capabilityLabel}>{capabilityLabel}</strong>
          <span className="task-row__cell task-row__state"><Badge tone={taskTone(task)}>{taskStateLabel(task)}</Badge></span>
          <span className="task-row__cell task-row__summary" title={summary}>{summary}</span>
          <span className="task-row__cell task-row__result" title={result.title}>{result.inspectable
            ? <button
                type="button"
                className="task-result-button"
                aria-haspopup="dialog"
                data-selected={selectedResultTaskId === task.id || undefined}
                onClick={() => setSelectedResultTaskId(task.id)}
              >{result.label}</button>
            : result.label}</span>
          <time className="task-row__cell task-row__time" dateTime={task.updatedAt ?? task.createdAt} title={time.title}>{time.label}</time>
          <span className="task-row__actions">
            {(task.state === 'queued' || task.state === 'running') && <IconButton name="x" label={t(locale, '停止', 'Stop')} onClick={() => { void stopTask(task.id); }} />}
            {canRetry && <IconButton name="rotate-ccw" label={t(locale, '重试', 'Retry')} onClick={() => { void retryTask(task.id); }} />}
          </span>
        </article>;
      })}
    </div> : tasks.length > 0 ? <div className="page-empty-state"><EmptyState
      icon="clock"
      title={t(locale, '没有匹配任务', 'No matching tasks')}
      description={t(locale, '当前分类没有任务记录。', 'No task records match this category.')}
    /></div> : <div className="page-empty-state"><EmptyState
      icon="clock"
      title={t(locale, '没有模型任务', 'No model tasks')}
      description={!libraryId ? t(
        locale,
        '示例不会提交真实生成请求。连接模型后，任务会显示来源、提供方、上传范围和可验证状态。',
        'The example does not submit real generation requests. Once connected, tasks show their source, provider, upload scope and verified state.',
      ) : ''}
    >
      <Button
        variant="secondary"
        icon="plug"
        onClick={() => navigate('connections')}
      >
        {t(locale, '连接模型', 'Connect models')}
      </Button>
    </EmptyState></div>}
    <TaskResultDrawer
      locale={locale}
      libraryId={libraryId}
      task={selectedResultTask}
      onClose={() => setSelectedResultTaskId(null)}
      onRetrySlot={(taskId, slotId) => { void retryGenerationSlot(taskId, slotId); }}
    />
  </section>;
};

const DeliveryPage = ({
  locale,
  project,
  format,
  archiveCopy,
  navigate,
  onFormatChange,
  onArchiveCopyChange,
  notify,
  active,
}: {
  locale: Locale;
  project?: Project | null;
  format: DeliveryFormat;
  archiveCopy: boolean;
  navigate: PageProps['navigate'];
  onFormatChange: (format: DeliveryFormat) => void;
  onArchiveCopyChange: (value: boolean) => void;
  notify?: (message: string) => void;
  active: boolean;
}) => {
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistoryRecord[]>([]);
  const [source] = useState<'current'>('current');
  const [drawerOpen, setDrawerOpen] = useState(Boolean(project));
  const selectedDesign = project?.designs?.[0];
  const deliveryScene: DesignScene | null = selectedDesign ? { version: 1, id: selectedDesign.id, width: selectedDesign.width, height: selectedDesign.height, layers: [{ id: selectedDesign.id, type: 'image', assetId: selectedDesign.assetId, x: 0, y: 0, width: selectedDesign.width, height: selectedDesign.height, rotation: 0, opacity: 1, visible: true, locked: false }] } : null;
  const sceneStatus: 'ready' | 'empty' = deliveryScene ? 'ready' : 'empty';
  const formatDescription =
    format === 'jpeg'
      ? t(
          locale,
          'JPEG 不支持透明背景，将使用当前背景色。',
          'JPEG does not support transparency; the current background color will be used.',
        )
      : format === 'pdf'
        ? t(
            locale,
            '普通 PDF 不是 PDF/X，文字外观可能需要栅格化。',
            'Standard PDF is not PDF/X; type may need rasterization to preserve appearance.',
          )
        : t(
            locale,
            'PNG 使用 sRGB，并保持当前画布像素尺寸。',
            'PNG uses sRGB and keeps the current canvas pixel dimensions.',
          );
  const projectName = project ? t(locale, project.name, project.enName) : '';
  const persistedProject = Boolean(project?.libraryId);
  useEffect(() => {
    setDrawerOpen(Boolean(project));
    setExportHistory([]);
    if (!project?.libraryId) return;
    let cancelled = false;
    const request = getDesktopApi().listExportHistory?.(project.libraryId, project.id);
    if (!request) return () => { cancelled = true; };
    void request.then((records) => {
      if (!cancelled && records) setExportHistory(records);
    }).catch(() => {
      if (!cancelled) setExportHistory([]);
    });
    return () => { cancelled = true; };
  }, [project?.id, project?.libraryId]);
  const hasExportableContent = useCallback((scene: DesignScene | null): scene is DesignScene => Boolean(scene?.layers.some((layer) => (
    layer.visible && !(layer.type === 'image' && (layer.role === 'reference' || layer.assetId === 'placeholder'))
  ))), []);
  useEffect(() => {
    return undefined;
  }, []);
  const exportCurrent = async (): Promise<void> => {
    if (!project?.libraryId || !selectedDesign || !deliveryScene) return;
    setExporting(true);
    try {
      const api = getDesktopApi();
      const scene = deliveryScene;
      if (!hasExportableContent(scene)) {
        notify?.(t(locale, '当前图片没有可导出的正式结果，请先在画布中选择候选稿并确认。', 'This image has no formal result to export. Select a candidate on the canvas and confirm it first.'));
        return;
      }
      const result = await api.exportProjectDesign?.({ libraryId: project.libraryId, projectId: project.id, designId: selectedDesign.id, format, scene, ...(format === 'jpeg' ? { background: '#ffffff' } : {}), ...(archiveCopy ? { archiveCopy: true } : {}) });
      if (result) {
        if (result.archiveError) {
          notify?.(t(locale, `已导出到 ${result.path}，归档副本失败（${result.archiveError}），可重试。`, `Exported to ${result.path}; the archive copy failed (${result.archiveError}). Retry when ready.`));
        } else if (result.archived) {
          notify?.(t(locale, `已导出并归档到 ${result.path}`, `Exported and archived from ${result.path}`));
        } else {
          notify?.(t(locale, `已导出到 ${result.path}`, `Exported to ${result.path}`));
        }
      }
    } catch {
      notify?.(t(locale, '导出失败，请重试。', 'Export failed. Try again.'));
    } finally { setExporting(false); }
  };
  const exportPackage = async (): Promise<void> => {
    if (!project?.libraryId) return;
    try {
      const result = await getDesktopApi().exportProjectPackage?.({ libraryId: project.libraryId, projectId: project.id });
      if (result) notify?.(t(locale, `项目包已导出到 ${result.path}`, `Project package exported to ${result.path}`));
    } catch {
      notify?.(t(locale, '项目包导出失败', 'Project package export failed'));
    }
  };
  const reexport = async (record: ExportHistoryRecord): Promise<void> => {
    if (!project?.libraryId) return;
    try {
      if (deliveryScene) {
        const result = await getDesktopApi().exportProjectDesign?.({ libraryId: project.libraryId, projectId: project.id, designId: selectedDesign?.id ?? project.id, format: record.format, scene: deliveryScene });
        if (result) notify?.(t(locale, `已重新导出到 ${result.path}`, `Re-exported to ${result.path}`));
      }
    } catch {
      notify?.(t(locale, '历史修订不可用，请重新导出当前版本。', 'The historical revision is unavailable; export the current version instead.'));
    }
  };
  return (
    <section className="page-content library-page">
      <PageHeader
        title={t(locale, '导出交付', 'Delivery')}
        eyebrow={t(locale, persistedProject ? '当前原稿' : '示例原稿', persistedProject ? 'Current source artwork' : 'Example source artwork')}
        description={
          project
            ? t(
                locale,
                persistedProject ? `为${project.name}配置输出格式。左侧显示当前图片原稿。` : `为${project.name}配置输出格式。左侧显示项目示例原稿。`,
                persistedProject ? `Configure output for ${project.enName}. The current image source appears on the left.` : `Configure output for ${project.enName}. The project’s example source artwork appears on the left.`,
              )
            : t(
                locale,
                '选择项目图片后配置输出格式。',
                'Select a project image to configure its output format.',
              )
        }
      />
      {project?.libraryId && <PageToolbarSlot active={active}>
        <IconButton name="download" label={t(locale, '导出当前设计稿', 'Export current design')} onClick={() => setDrawerOpen(true)} />
      </PageToolbarSlot>}
      <div className="delivery-layout">
        {project ? (
          <div className="delivery-preview">
            <ArtworkPreview kind={project.artwork} />
            <div>
              <Badge>{t(locale, '原稿', 'Source')}</Badge>
              <h2>{projectName}</h2>
              <p>
                {(() => {
                  const dimensions = `${selectedDesign?.width ?? 1080} × ${selectedDesign?.height ?? 1440}`;
                  return t(locale, `${dimensions} 像素 · sRGB`, `${dimensions} px · sRGB`);
                })()}
              </p>
              <small className="source-note">
                  {t(locale, '导出将读取当前设计稿结果。', 'Export reads the current design result.')}
              </small>
            </div>
          </div>
        ) : (
          <div className="delivery-preview delivery-preview--empty">
            <EmptyState
              icon="file-image"
              title={t(locale, '选择图片', 'Select an image')}
              description={t(
                locale,
                '从项目中选择一张图片，再返回这里配置交付预览。',
                'Select an image from a project, then return here to configure its delivery preview.',
              )}
            >
              <Button
                variant="secondary"
                icon="arrow-left"
                onClick={() => navigate('projects')}
              >
                {t(locale, '返回项目', 'View projects')}
              </Button>
            </EmptyState>
          </div>
        )}
        {project && <Drawer
          open={drawerOpen}
          title={t(locale, '导出配置', 'Delivery configuration')}
          locale={locale}
          onClose={() => setDrawerOpen(false)}
          footer={(
            <div className="export-bar">
              <div>
                <strong>{t(locale, '尚未选择目标目录', 'No destination selected')}</strong>
                <span>{t(locale, persistedProject ? '使用桌面保存对话框写出并校验文件。' : '桌面导出能力接入后才可执行。', persistedProject ? 'Use the desktop save dialog to write and validate the file.' : 'Available after desktop export support is connected.')}</span>
              </div>
              <Button variant="primary" icon="download" disabled={!project?.libraryId || !selectedDesign || exporting || sceneStatus === 'empty'} onClick={() => { void exportCurrent(); }}>
                {exporting ? t(locale, '处理中', 'Working') : t(locale, '导出', 'Export')}
              </Button>
            </div>
          )}
        ><div className="delivery-config">
          <div className="config-section">
            <p className="panel-label">
              {t(locale, '输出格式', 'Output format')}
            </p>
            <div
              className="format-picker"
              role="group"
              aria-label={t(locale, '输出格式', 'Output format')}
            >
              {(['png', 'jpeg', 'webp', 'pdf'] as DeliveryFormat[]).map((option) => (
                <button
                  type="button"
                  key={option}
                  className={format === option ? 'is-selected' : ''}
                  aria-pressed={format === option}
                  onClick={() => onFormatChange(option)}
                >
                  <Icon
                    name={option === 'pdf' ? 'file-image' : 'image'}
                    size={17}
                  />
                  {t(locale, option.toUpperCase(), option.toUpperCase())}
                </button>
              ))}
            </div>
            <p className="format-note">
              <Icon name="circle-alert" size={15} />
              {formatDescription}
            </p>
          </div>
          <div className="config-grid">
            <Field label={t(locale, '来源', 'Source')}>
              <Select ariaLabel={t(locale, '来源', 'Source')} value={source} disabled onChange={() => undefined} options={[{ value: 'current', label: t(locale, persistedProject ? '当前设计稿' : '示例原稿', persistedProject ? 'Current design' : 'Example source artwork') }]} />
            </Field>
            <Field label={t(locale, '颜色空间', 'Color space')}>
              <Select ariaLabel={t(locale, '颜色空间', 'Color space')} value="srgb" disabled onChange={() => undefined} options={[{ value: 'srgb', label: t(locale, 'sRGB（首版）', 'sRGB (first release)') }]} />
            </Field>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={archiveCopy}
              onChange={(event) => onArchiveCopyChange(event.target.checked)}
            />
            <span>
              <strong>
                {t(locale, '同时归档到项目', 'Also archive in project')}
              </strong>
              <small>
                {t(
                  locale,
                  persistedProject ? '导出会读取当前设计稿，并可选择归档副本。' : '仅配置选项；示例不会写入 exports 目录。',
                  persistedProject ? 'Export reads the current design and can archive a copy.' : 'Configuration only; the example does not write to the exports directory.',
                )}
              </small>
            </span>
          </label>
          {persistedProject && <div className="export-history" aria-label={t(locale, '导出历史', 'Export history')}>
            <p className="panel-label">{t(locale, '导出历史', 'Export history')}</p>
            {exportHistory.length === 0 ? <small>{t(locale, '暂无导出记录。', 'No export records yet.')}</small> : exportHistory.slice(0, 5).map((record) => (
              <div className="export-history-row" key={record.id}>
                <span>{record.format.toUpperCase()} · {record.revisionId}{record.targetAvailable === false ? ` · ${t(locale, '目标已移动', 'Target moved')}` : ''}</span>
                <span className="export-history-row__actions">
                  <Badge tone={record.status === 'success' ? 'success' : 'error'}>
                    {record.status === 'success' ? t(locale, '成功', 'Success') : t(locale, '失败', 'Failed')}
                  </Badge>
                  {record.status === 'success' && <IconButton name="rotate-ccw" label={t(locale, '重新导出', 'Re-export')} onClick={() => { void reexport(record); }} />}
                </span>
              </div>
            ))}
          </div>}
          {persistedProject && <Button variant="secondary" icon="download" onClick={() => { void exportPackage(); }}>{t(locale, '导出项目包', 'Export project package')}</Button>}
        </div></Drawer>}
      </div>
    </section>
  );
};

const StoragePage = ({
  locale,
  tab,
  onTabChange,
  libraryId,
  readOnly = false,
  notify,
}: {
  locale: Locale;
  tab: StorageTab;
  onTabChange: (tab: StorageTab) => void;
  libraryId?: string;
  readOnly?: boolean;
  notify?: (message: string) => void;
}) => {
  const [trash, setTrash] = useState<TrashedProject[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [backupDestination, setBackupDestination] = useState<string | null>(null);
  const [backupSchedule, setBackupSchedule] = useState<BackupSchedule>('manual');
  const [backupLastRunAt, setBackupLastRunAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!libraryId || readOnly) {
      setTrash([]);
      return () => { cancelled = true; };
    }
    setLoadingTrash(true);
    void getDesktopApi().listTrashedProjects?.(libraryId).then((entries) => {
      if (!cancelled) setTrash(entries ?? []);
    }).catch(() => {
      if (!cancelled) notify?.(t(locale, '废纸篓读取失败', 'Could not load trash'));
    }).finally(() => {
      if (!cancelled) setLoadingTrash(false);
    });
    return () => { cancelled = true; };
  }, [locale, notify, readOnly, libraryId]);
  useEffect(() => {
    if (!libraryId) {
      setBackupPath(null);
      setBackupDestination(null);
      setBackupSchedule('manual');
      setBackupLastRunAt(null);
      return;
    }
    const preferences = readBackupPreferences(libraryId);
    const applyPreferences = (next: BackupPreferences): void => {
      setBackupPath(next.lastArtifactPath);
      setBackupDestination(next.destinationParentDirectory);
      setBackupSchedule(next.schedule);
      setBackupLastRunAt(next.lastRunAt);
    };
    applyPreferences(preferences);
    let cancelled = false;
    void (getDesktopApi().loadWorkspaceSettings?.(libraryId) ?? Promise.resolve(null)).then((stored) => {
      if (cancelled || !stored) return;
      const next = stored.backup;
      applyPreferences(next);
      writeBackupPreferences(libraryId, next);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [libraryId]);
  const restore = async (projectId: string): Promise<void> => {
    if (!libraryId || readOnly) return;
    setBusy(true);
    try {
      const result = await getDesktopApi().restoreProjectFromTrash?.({ libraryId, projectId });
      if (result) {
        setTrash((current) => current.filter((entry) => entry.projectId !== projectId));
        notify?.(t(locale, '项目已恢复', 'Project restored'));
      }
    } catch {
      notify?.(t(locale, '恢复失败，请重试', 'Restore failed; try again'));
    } finally { setBusy(false); }
  };
  const purge = async (projectId: string): Promise<void> => {
    if (!libraryId || readOnly || !window.confirm(t(locale, '永久删除此项目？', 'Permanently delete this project?'))) return;
    setBusy(true);
    try {
      const result = await getDesktopApi().purgeProjectFromTrash?.({ libraryId, projectId });
      if (result) {
        setTrash((current) => current.filter((entry) => entry.projectId !== projectId));
        notify?.(t(locale, '项目已删除', 'Project deleted'));
      }
    } catch {
      notify?.(t(locale, '删除失败，项目可能仍被引用', 'Delete failed; the project may still be referenced'));
    } finally { setBusy(false); }
  };
  const performBackup = useCallback(async (destinationParentDirectory: string): Promise<void> => {
    if (!libraryId || readOnly || busy) return;
    setBusy(true);
    try {
      const artifact = await getDesktopApi().createWorkspaceBackup?.(libraryId, destinationParentDirectory);
      if (artifact) {
        const lastRunAt = artifact.createdAt;
        setBackupPath(artifact.directory);
        setBackupLastRunAt(lastRunAt);
        persistBackupPreferences(libraryId, { destinationParentDirectory, schedule: backupSchedule, lastRunAt, lastArtifactPath: artifact.directory });
        notify?.(t(locale, '备份已创建', 'Backup created'));
      }
    } catch {
      notify?.(t(locale, '备份失败，请重试', 'Backup failed; try again'));
    } finally { setBusy(false); }
  }, [backupSchedule, busy, locale, notify, readOnly, libraryId]);
  const chooseBackupDestination = async (): Promise<void> => {
    if (!libraryId || readOnly || busy) return;
    setBusy(true);
    try {
      const destination = await getDesktopApi().chooseWorkspaceBackupDirectory?.('destination');
      if (!destination) return;
      const preferences = { ...readBackupPreferences(libraryId), destinationParentDirectory: destination, schedule: backupSchedule };
      setBackupDestination(destination);
      persistBackupPreferences(libraryId, preferences);
      notify?.(t(locale, '备份位置已更新', 'Backup destination updated'));
    } catch {
      notify?.(t(locale, '无法选择备份位置', 'Could not choose a backup destination'));
    } finally { setBusy(false); }
  };
  const createBackup = async (): Promise<void> => {
    if (!libraryId || readOnly) return;
    const destination = backupDestination;
    if (!destination) {
      notify?.(t(locale, '请先在备份设置中选择目标目录', 'Choose a backup destination in settings first'));
      return;
    }
    if (!destination) return;
    setBackupDestination(destination);
    const preferences = readBackupPreferences(libraryId);
    persistBackupPreferences(libraryId, { ...preferences, destinationParentDirectory: destination, schedule: backupSchedule });
    await performBackup(destination);
  };
  const updateBackupSchedule = (schedule: BackupSchedule): void => {
    if (!libraryId) return;
    setBackupSchedule(schedule);
    const preferences = readBackupPreferences(libraryId);
    persistBackupPreferences(libraryId, { ...preferences, schedule });
  };
  useEffect(() => {
    if (!libraryId || readOnly || !backupDestination) return undefined;
    const interval = backupIntervalMs(backupSchedule);
    if (interval === null) return undefined;
    const timer = window.setInterval(() => {
      const preferences = readBackupPreferences(libraryId);
      if (shouldRunScheduledBackup({ schedule: backupSchedule, lastRunAt: preferences.lastRunAt ?? backupLastRunAt, now: Date.now() })) void performBackup(backupDestination);
    }, Math.min(interval, 60 * 1000));
    return () => window.clearInterval(timer);
  }, [backupDestination, backupLastRunAt, backupSchedule, performBackup, readOnly, libraryId]);
  const restoreBackup = async (): Promise<void> => {
    if (!libraryId || readOnly || busy) return;
    setBusy(true);
    try {
      const api = getDesktopApi();
      const backupDirectory = await api.chooseWorkspaceBackupDirectory?.('source');
      if (!backupDirectory) return;
      const destinationParentDirectory = await api.chooseWorkspaceBackupDirectory?.('destination');
      if (!destinationParentDirectory) return;
      const result = await api.restoreWorkspaceBackup?.({ backupDirectory, destinationParentDirectory });
      if (!result) throw new Error('BACKUP_RESTORE_FAILED');
      notify?.(t(locale, `备份已恢复到 ${result.directory}`, `Backup restored to ${result.directory}`));
    } catch {
      notify?.(t(locale, '恢复失败，请重试', 'Restore failed; try again'));
    } finally { setBusy(false); }
  };
  const hasWorkspace = Boolean(libraryId);
  return (
  <section className="page-content library-page">
    <PageHeader
      title={t(locale, '废纸篓与备份', 'Trash & backups')}
      eyebrow={t(locale, '本地内容', 'Local content')}
      description={t(
        locale,
        hasWorkspace ? '检查废纸篓与本地备份状态。' : '打开工作区后管理废纸篓与备份。',
        hasWorkspace ? 'Review trash and local backup state.' : 'Open a workspace to manage trash and backups.',
      )}
    />
    <div
      className="tab-bar"
      aria-label={t(locale, '废纸篓与备份', 'Trash & backups')}
    >
      <button
        type="button"
        aria-pressed={tab === 'trash'}
        onClick={() => onTabChange('trash')}
      >
        <Icon name="trash-2" size={17} />
        {t(locale, '废纸篓', 'Trash')}
      </button>
      <button
        type="button"
        aria-pressed={tab === 'backup'}
        onClick={() => onTabChange('backup')}
      >
        <Icon name="hard-drive" size={17} />
        {t(locale, '备份', 'Backup')}
      </button>
    </div>
    {tab === 'trash' ? (
      <div className="storage-panel">
        {!hasWorkspace || readOnly ? <div className="page-empty-state"><EmptyState
          icon="trash-2"
          title={readOnly ? t(locale, '只读工作区', 'Read-only workspace') : t(locale, '废纸篓为空', 'Trash is empty')}
          description={t(
            locale,
            readOnly ? '只读模式下不能修改废纸篓。' : '删除的项目、图片和素材会显示原位置、删除时间与引用限制。',
            readOnly ? 'Trash cannot be modified in read-only mode.' : 'Deleted projects, images and assets show their original location, deletion time and reference limits.',
          )}
        /></div> : loadingTrash ? <p className="storage-loading">{t(locale, '读取中', 'Loading')}</p> : trash.length === 0 ? <div className="page-empty-state"><EmptyState
          icon="trash-2"
          title={t(locale, '废纸篓为空', 'Trash is empty')}
          description={t(locale, '删除的项目不会自动过期。', 'Deleted projects do not expire automatically.')}
        /></div> : <div className="trash-list" aria-label={t(locale, '废纸篓项目', 'Trash items')}>
          {trash.map((entry) => <article className="trash-row" key={entry.projectId}>
            <div><strong>{entry.projectId}</strong><small>{entry.originalRelativePath}</small><small>{new Date(entry.deletedAt).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en')}</small></div>
            <div className="trash-actions"><Button variant="secondary" icon="rotate-ccw" disabled={busy} onClick={() => { void restore(entry.projectId); }}>{t(locale, '恢复', 'Restore')}</Button><Button variant="ghost" icon="trash-2" disabled={busy} onClick={() => { void purge(entry.projectId); }}>{t(locale, '删除', 'Delete')}</Button></div>
          </article>)}
        </div>}
      </div>
    ) : (
      <div className="storage-panel backup-panel">
        <div className="backup-status">
          <span className="storage-icon">
            <Icon name="hard-drive" size={24} />
          </span>
          <div>
            <p className="section-kicker">
              {t(locale, '本地备份', 'Local backup')}
            </p>
            <h2>
              {backupDestination ? t(locale, '备份已就绪', 'Backup ready') : t(locale, '尚未配置备份位置', 'No backup destination configured')}
            </h2>
            <p>
              {t(
                locale,
                backupPath ?? t(locale, '备份默认不上传云端。', 'Backups are not uploaded by default.'),
                backupPath ?? 'Backups are not uploaded by default.',
              )}
            </p>
          </div>
          <Badge>{backupLastRunAt ? t(locale, '已验证', 'Verified') : backupDestination ? t(locale, '已配置', 'Configured') : t(locale, '未配置', 'Not configured')}</Badge>
        </div>
        <dl className="details-list backup-facts">
          <DetailRow label={t(locale, '上次成功', 'Last success')}>
            {backupLastRunAt ? new Date(backupLastRunAt).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US') : t(locale, '无记录', 'No record')}
          </DetailRow>
          <DetailRow label={t(locale, '目标位置', 'Destination')}>
            {backupDestination ?? t(locale, '未选择', 'Not selected')}
          </DetailRow>
          <DetailRow label={t(locale, '备份周期', 'Schedule')}>
            {backupSchedule === 'daily' ? t(locale, '每天', 'Daily') : backupSchedule === 'weekly' ? t(locale, '每周', 'Weekly') : t(locale, '手动', 'Manual')}
          </DetailRow>
        </dl>
        <div className="backup-settings">
          <Field label={t(locale, '备份周期', 'Backup schedule')}>
            <Select ariaLabel={t(locale, '备份周期', 'Backup schedule')} value={backupSchedule} disabled={!hasWorkspace || readOnly || busy} onChange={(value) => updateBackupSchedule(value as BackupSchedule)} options={[{ value: 'manual', label: t(locale, '手动', 'Manual') }, { value: 'daily', label: t(locale, '每天', 'Daily') }, { value: 'weekly', label: t(locale, '每周', 'Weekly') }]} />
          </Field>
        </div>
        <div className="storage-actions">
          <Button icon="folder-open" disabled={!hasWorkspace || readOnly || busy} onClick={() => { void chooseBackupDestination(); }}>{t(locale, '选择备份位置', 'Choose backup destination')}</Button>
          <Button icon="download" disabled={!hasWorkspace || readOnly || busy} onClick={() => { void createBackup(); }}>{t(locale, '创建备份', 'Create backup')}</Button>
          <Button icon="upload" disabled={!hasWorkspace || readOnly || busy} onClick={() => { void restoreBackup(); }}>{t(locale, '恢复备份', 'Restore backup')}</Button>
        </div>
      </div>
    )}
  </section>
  );
};

const ThemeChoice = ({
  locale,
  value,
  current,
  icon,
  onChange,
}: {
  locale: Locale;
  value: Theme;
  current: Theme;
  icon: string;
  onChange: (theme: Theme) => void;
}) => {
  const label =
    value === 'system'
      ? t(locale, '跟随系统', 'System')
      : value === 'dark'
        ? t(locale, '深色', 'Dark')
        : t(locale, '浅色', 'Light');
  return (
    <label className={`theme-choice ${current === value ? 'is-selected' : ''}`}>
      <input
        type="radio"
        name="theme"
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
      />
      <span>
        <Icon name={icon} size={19} />
        {label}
      </span>
      <Icon
        name={current === value ? 'circle-check' : 'circle-help'}
        size={16}
      />
    </label>
  );
};

const SettingsPage = ({
  locale,
  theme,
  navigate,
  onThemeChange,
  onLocaleChange,
  notify,
  libraryId,
  operatorName = '',
  onOperatorNameChange,
}: Pick<
  LibraryPagesProps,
  'locale' | 'theme' | 'navigate' | 'onThemeChange' | 'onLocaleChange'
> & { notify?: (message: string) => void; libraryId?: string; operatorName?: string; onOperatorNameChange?: (name: string) => void }) => {
  const [hasConnectedModel, setHasConnectedModel] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const api = getDesktopApi();
    void Promise.all([
      Promise.all(providerProfiles.map(async (profile) => getDesktopApi().hasCredential?.(providerCredentialAccount('openai-compatible', profile)) ?? false)),
      api.loadProviderConfigs?.() ?? Promise.resolve(null),
      api.loadProviderConnectionStatuses?.() ?? Promise.resolve(null),
    ])
      .then(([entries, configs, statuses]) => {
        if (cancelled) return;
        const connected = api.loadProviderConnectionStatuses
          ? providerProfiles.some((profile, index) => entries[index] && getProviderProfileStatus(statuses, 'openai-compatible', profile, configs ?? undefined) === 'connected')
          : entries.some(Boolean);
        setHasConnectedModel(connected);
      })
      .catch(() => { if (!cancelled) setHasConnectedModel(false); });
    return () => { cancelled = true; };
  }, [libraryId]);
  const exportDiagnostics = async (): Promise<void> => {
    const path = await getDesktopApi().exportDiagnostics?.({ runtime: 'Electron', errorCode: null });
    if (path) notify?.(t(locale, `诊断包已导出到 ${path}`, `Diagnostics exported to ${path}`));
  };
  return (
  <section className="page-content library-page">
    <PageHeader
      title={t(locale, '设置', 'Settings')}
      eyebrow={t(locale, '应用偏好', 'Application preferences')}
      description={t(
        locale,
        '外观与语言会立即应用；工作区和连接仍由真实桌面能力管理。',
        'Appearance and language apply immediately; workspace and connections remain managed by real desktop capabilities.',
      )}
    />
    <div className="settings-layout">
      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-icon">
            <Icon name="palette" size={19} />
          </span>
          <div>
            <h2>{t(locale, '外观', 'Appearance')}</h2>
            <p>
              {t(
                locale,
                '主题不改变布局、字号或图像颜色。',
                'Theme does not change layout, typography or artwork color.',
              )}
            </p>
          </div>
        </div>
        <div className="theme-grid">
          <ThemeChoice
            locale={locale}
            value="system"
            current={theme}
            icon="monitor"
            onChange={onThemeChange}
          />
          <ThemeChoice
            locale={locale}
            value="dark"
            current={theme}
            icon="moon"
            onChange={onThemeChange}
          />
          <ThemeChoice
            locale={locale}
            value="light"
            current={theme}
            icon="sun"
            onChange={onThemeChange}
          />
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-icon"><Icon name="user" size={19} /></span>
          <div>
            <h2>{t(locale, '本机操作者', 'Local operator')}</h2>
            <p>{t(locale, '仅用于版本与时间线署名，不创建账号。', 'Used only for revision attribution; no account is created.')}</p>
          </div>
        </div>
        <div className="settings-control">
          <Field label={t(locale, '本机操作者', 'Local operator')}>
            <input aria-label={t(locale, '本机操作者', 'Local operator')} value={operatorName} onChange={(event) => onOperatorNameChange?.(event.target.value)} />
          </Field>
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-icon">
            <Icon name="type" size={19} />
          </span>
          <div>
            <h2>{t(locale, '语言与地区', 'Language and region')}</h2>
            <p>
              {t(
                locale,
                '切换会立即更新本次会话界面。',
                'Changes update this session immediately.',
              )}
            </p>
          </div>
        </div>
        <div className="settings-control">
          <Field label={t(locale, '语言', 'Language')}>
            <Select ariaLabel={t(locale, '语言', 'Language')} value={locale} onChange={(value) => onLocaleChange(value as Locale)} options={[{ value: 'zh-CN', label: t(locale, '简体中文', 'Simplified Chinese') }, { value: 'en', label: t(locale, 'English', 'English') }]} />
          </Field>
          <span>
            {t(
              locale,
              '日期与数字跟随所选语言。',
              'Dates and numbers follow the selected language.',
            )}
          </span>
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-icon">
            <Icon name="plug" size={19} />
          </span>
          <div>
            <h2>{t(locale, '模型与诊断', 'Models and diagnostics')}</h2>
            <p>
              {t(
                locale,
                '检查连接入口与本地诊断包范围。',
                'Review connection entry points and the local diagnostic package scope.',
              )}
            </p>
          </div>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="settings-row-button"
            onClick={() => navigate('connections')}
          >
            <span>
              <strong>{t(locale, '模型连接', 'Model connections')}</strong>
              <small>
                {t(
                  locale,
                  hasConnectedModel ? '已有已配置连接' : '当前没有已配置连接',
                  hasConnectedModel ? 'A connection is configured' : 'No connections are configured',
                )}
              </small>
            </span>
            <Icon name="arrow-up-right" size={17} />
          </button>
          <div className="settings-disabled-row">
            <span>
              <strong>
                {t(locale, '本地诊断包', 'Local diagnostic package')}
              </strong>
              <small>
                {t(
                  locale,
                  '需先接入内容预览与保存位置选择。',
                  'Requires content preview and destination selection support.',
                )}
              </small>
            </span>
            <Button icon="download" onClick={() => { void exportDiagnostics(); }}>{t(locale, '导出', 'Export')}</Button>
          </div>
        </div>
      </section>
    </div>
  </section>
  );
};

export const LibraryPages = ({
  view,
  locale,
  notify,
  navigate,
  theme,
  onThemeChange,
  onLocaleChange,
  deliveryProject,
  onUseForNew,
  libraryId,
  preview = false,
  readOnly = false,
  projectId,
  operatorName,
  onOperatorNameChange,
  onAssetAction,
  initialAssets = [],
  initialProfiles = [],
  active = true,
  connectionsDialogOpen,
  onConnectionsDialogClose,
  designerCreateRequestId,
  onDesignerProfilesChange,
}: LibraryPagesProps) => {
  const [imageToolJobs, setImageToolJobs] = useState<Array<{ job: ImageToolJob; items: ImageToolItem[] }>>([]);
  const refreshImageToolJobs = useCallback(async (): Promise<void> => {
    const api = getDesktopApi();
    if (!libraryId || !api.listImageToolJobs) return;
    const loaded = await api.listImageToolJobs(libraryId);
    if (loaded) setImageToolJobs(loaded);
  }, [libraryId]);
  useEffect(() => {
    if (!(view === 'image-tools' || view.startsWith('image-tool-'))) return;
    void refreshImageToolJobs();
    const timer = window.setInterval(() => { void refreshImageToolJobs(); }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshImageToolJobs, view]);
  const [assetQuery, setAssetQuery] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('all');
  const [assetLayout, setAssetLayout] = useState<'grid' | 'list'>('grid');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [deliveryFormat, setDeliveryFormat] = useState<DeliveryFormat>('png');
  const [archiveCopy, setArchiveCopy] = useState(false);
  const [storageTab, setStorageTab] = useState<StorageTab>('trash');
  const renderImageToolsPage = (tool?: BatchImageTool): ReactNode => !active ? null : (
    <Suspense fallback={<EmptyState icon="loader-circle" title={t(locale, '正在加载图像工具', 'Loading image tools')} description={t(locale, '正在准备批量处理工作台。', 'Preparing the batch image workbench.')} />}>
      <ImageToolsPage
      locale={locale}
      tool={tool}
      jobs={imageToolJobs}
      onChooseInput={async () => getDesktopApi().chooseImageToolInput?.() ?? null}
      onChooseOutput={async () => getDesktopApi().chooseImageToolOutput?.() ?? null}
      onOpenConnections={() => navigate('connections')}
      onScan={async (input) => {
        if (!libraryId) return null;
        const result = await getDesktopApi().scanImageToolSources?.({ libraryId, ...input });
        return result ? { accepted: result.accepted.map((item) => ({ relativePath: item.relativePath })), rejected: result.rejected } : null;
      }}
      onCreate={async (input) => {
        const api = getDesktopApi();
        if (!libraryId || !api.createImageToolJob) return;
        await api.createImageToolJob({ libraryId, ...input });
        await refreshImageToolJobs();
      }}
      onPause={async (jobId) => { if (libraryId) { await getDesktopApi().pauseImageToolJob?.({ libraryId, jobId }); await refreshImageToolJobs(); } }}
      onResume={async (jobId) => { if (libraryId) { await getDesktopApi().resumeImageToolJob?.({ libraryId, jobId }); await refreshImageToolJobs(); } }}
      onCancel={async (jobId) => { if (libraryId) { await getDesktopApi().cancelImageToolJob?.({ libraryId, jobId }); await refreshImageToolJobs(); } }}
      onRetryItem={async (jobId, itemId) => { if (libraryId) { await getDesktopApi().retryImageToolItem?.({ libraryId, jobId, itemId }); await refreshImageToolJobs(); } }}
      onCancelItem={async (jobId, itemId) => { if (libraryId) { await getDesktopApi().cancelImageToolItem?.({ libraryId, jobId, itemId }); await refreshImageToolJobs(); } }}
      onReadResult={async (path, jobId) => {
        if (!libraryId) return null;
        return getDesktopApi().readImageToolResult?.({ libraryId, jobId, path }) ?? null;
      }}
      onOpenResult={async (path, jobId) => { if (libraryId) await getDesktopApi().openImageToolResult?.({ libraryId, jobId, path }); }}
      onRevealResult={async (path, jobId) => { if (libraryId) await getDesktopApi().revealImageToolResult?.({ libraryId, jobId, path }); }}
      onOpenOutput={async (path, jobId) => { if (libraryId) await getDesktopApi().openImageToolOutput?.({ libraryId, jobId, path }); }}
      onImportResult={async (path, jobId) => { if (libraryId && projectId) await getDesktopApi().importImageToolResult?.({ libraryId, projectId, jobId, path }); }}
      />
    </Suspense>
  );
  const pages: Record<Exclude<View, 'projects'>, ReactNode> = {
    designers: (
      <DesignerLibrary
        locale={locale}
        notify={notify}
        onUseForNew={onUseForNew}
        libraryId={libraryId}
        preview={preview}
        initialProfiles={initialProfiles}
        readOnly={readOnly}
        toolbarActive={active}
        createRequestId={designerCreateRequestId}
        onProfilesChange={onDesignerProfilesChange}
      />
    ),
    assets: (
      <AssetsPage
        locale={locale}
        query={assetQuery}
        type={assetType}
        layout={assetLayout}
        selectedId={selectedAsset}
        onQueryChange={setAssetQuery}
        onTypeChange={setAssetType}
        onLayoutChange={setAssetLayout}
        onSelect={setSelectedAsset}
        libraryId={libraryId}
        preview={preview}
        initialAssets={initialAssets}
        projectId={projectId}
        readOnly={readOnly}
        notify={notify}
        onAssetAction={onAssetAction}
        active={active}
      />
    ),
    connections: <ConnectionsPage
      locale={locale}
      libraryId={libraryId}
      dialogOpen={connectionsDialogOpen}
      onDialogClose={onConnectionsDialogClose}
    />,
    tasks: <TasksPage locale={locale} navigate={navigate} libraryId={libraryId} active={active} />,
    'image-tools': renderImageToolsPage(),
    'image-tool-remove-background': renderImageToolsPage('remove-background'),
    'image-tool-upscale': renderImageToolsPage('upscale'),
    'image-tool-resize': renderImageToolsPage('resize'),
    'image-tool-format-convert': renderImageToolsPage('format-convert'),
    delivery: (
      <DeliveryPage
        locale={locale}
        project={deliveryProject}
        format={deliveryFormat}
        archiveCopy={archiveCopy}
        navigate={navigate}
        onFormatChange={setDeliveryFormat}
        onArchiveCopyChange={setArchiveCopy}
        notify={notify}
        active={active}
      />
    ),
    storage: (
      <StoragePage
        locale={locale}
        tab={storageTab}
        onTabChange={setStorageTab}
        libraryId={libraryId}
        readOnly={readOnly}
        notify={notify}
      />
    ),
    settings: (
      <SettingsPage
        locale={locale}
        theme={theme}
        navigate={navigate}
        onThemeChange={onThemeChange}
        onLocaleChange={onLocaleChange}
        notify={notify}
        operatorName={operatorName}
        onOperatorNameChange={onOperatorNameChange}
        libraryId={libraryId}
      />
    ),
  };
  return (
    <>
      {pages[view]}
    </>
  );
};

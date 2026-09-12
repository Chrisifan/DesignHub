import {
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import type { Locale } from '../i18n';
import type { PageProps, Project, Theme, View } from './types';
import { DesignerLibrary } from './DesignerLibrary';
import {
  ArtworkPreview,
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  t,
} from './ui';
import { getDesktopApi } from '../../platform/runtime';
import type { ManagedAsset } from '../../features/assets/import-assets';
import { createScene } from '../../features/canvas/scene';
import { ProviderSettings } from '../../features/providers/ProviderSettings';
import { BrandEditor } from '../../features/brands/BrandEditor';
import type { Brand } from '../../features/brands/constraints';
import type { ProviderConnection } from '../../features/providers/connection';
import type { TaskRecord } from '../../features/tasks/state';
import type { TrashedProject } from '../../features/workspace/project-store';
import type { WorkspaceDescriptor } from '../../features/workspace/open-workspace';
import './library.css';

type LibraryPagesProps = PageProps & {
  view: Exclude<View, 'projects'>;
  theme: Theme;
  onThemeChange: (value: Theme) => void;
  onLocaleChange: (value: Locale) => void;
  deliveryProject?: Project | null;
  onUseForNew?: (personaId: string) => void;
  workspaceId?: string;
  readOnly?: boolean;
  projectId?: string;
  onWorkspaceChange?: (workspace: WorkspaceDescriptor) => void;
  operatorName?: string;
  onOperatorNameChange?: (name: string) => void;
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
type BrandKit = {
  id: string;
  name: Localized;
  description: Localized;
  version: string;
  tone: Localized;
  font: Localized;
  copy: Localized;
};
type DeliveryFormat = 'png' | 'jpeg' | 'webp' | 'pdf';
type StorageTab = 'trash' | 'backup';

const availableConnections: readonly ProviderConnection[] = [
  { id: 'openai-compatible', label: 'OpenAI compatible', status: 'not-configured', capabilities: ['conversation', 'vision-analysis', 'image-generation', 'image-editing'] },
];

const assets: AssetItem[] = [
  {
    id: 'market-photo',
    name: { zh: '市集原图', en: 'Market original' },
    type: 'image',
    typeName: { zh: '图像', en: 'Image' },
    meta: { zh: 'JPEG · 4032 × 3024', en: 'JPEG · 4032 × 3024' },
    source: { zh: '本机导入 · 受管副本', en: 'Local import · managed copy' },
    usage: { zh: '春间市集 / 主海报', en: 'Spring in bloom / Main poster' },
    artwork: 'market',
  },
  {
    id: 'spring-logo',
    name: { zh: '春间标志', en: 'Spring mark' },
    type: 'logo',
    typeName: { zh: '标志', en: 'Logo' },
    meta: { zh: 'SVG · 640 × 240', en: 'SVG · 640 × 240' },
    source: { zh: '品牌包 · 安全矢量', en: 'Brand kit · safe vector' },
    usage: { zh: '春间市集 / 3 份文档', en: 'Spring in bloom / 3 documents' },
    artwork: 'blank',
  },
  {
    id: 'paper-texture',
    name: { zh: '再生纸纹理', en: 'Recycled paper texture' },
    type: 'texture',
    typeName: { zh: '纹理', en: 'Texture' },
    meta: { zh: 'PNG · 2048 × 2048', en: 'PNG · 2048 × 2048' },
    source: { zh: '示例素材 · 受管副本', en: 'Example asset · managed copy' },
    usage: { zh: '2 个项目', en: '2 projects' },
    artwork: 'objects',
  },
  {
    id: 'type-scan',
    name: { zh: '字形扫描', en: 'Letterform scan' },
    type: 'image',
    typeName: { zh: '图像', en: 'Image' },
    meta: { zh: 'WEBP · 1800 × 2400', en: 'WEBP · 1800 × 2400' },
    source: { zh: '本机导入 · 受管副本', en: 'Local import · managed copy' },
    usage: { zh: '字形之间 / 封面', en: 'Type & form / Cover' },
    artwork: 'type',
  },
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

const brands: BrandKit[] = [
  {
    id: 'spring',
    name: { zh: '春间市集', en: 'Spring in bloom' },
    description: {
      zh: '活动视觉与社交媒体物料',
      en: 'Campaign and social media materials',
    },
    version: 'v3',
    tone: { zh: '轻松、自然、有城市感', en: 'Relaxed, natural and urban' },
    font: { zh: '思源宋体 / Geist', en: 'Source Han Serif / Geist' },
    copy: { zh: '把春天带回家', en: 'Bring spring home' },
  },
  {
    id: 'objects',
    name: { zh: '日常之物', en: 'Everyday objects' },
    description: {
      zh: '生活方式产品与目录',
      en: 'Lifestyle products and catalogues',
    },
    version: 'v1',
    tone: { zh: '清晰、平静、重视功能', en: 'Clear, calm and function-led' },
    font: { zh: 'Geist / JetBrains Mono', en: 'Geist / JetBrains Mono' },
    copy: { zh: '少即是多。', en: 'Less, but better.' },
  },
];

const brandRecords: Brand[] = brands.map((brand) => ({
  id: brand.id,
  name: brand.name.zh,
  version: brand.version,
  logo: `${brand.id}-mark`,
  colorPalette: brand.id === 'spring' ? ['#F4EFE7', '#24262B', '#8C7057'] : ['#D8F1ED', '#173B43', '#4AAE9B'],
  fonts: brand.font.zh.split(' / '),
  tone: brand.tone.zh,
  fixedCopy: brand.copy.zh,
  sizes: ['1080x1440', '1080x1080'],
}));

const recordToKit = (record: Brand): BrandKit => ({
  id: record.id,
  name: { zh: record.name ?? record.id, en: record.name ?? record.id },
  description: { zh: record.description ?? '工作区品牌规则', en: record.description ?? 'Workspace brand rules' },
  version: record.version,
  tone: { zh: record.tone, en: record.tone },
  font: { zh: record.fonts.join(' / '), en: record.fonts.join(' / ') },
  copy: { zh: record.fixedCopy, en: record.fixedCopy },
});

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
  workspaceId,
  projectId,
  readOnly,
  notify,
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
  workspaceId?: string;
  projectId?: string;
  readOnly?: boolean;
  notify?: (message: string) => void;
}) => {
  const [managedAssets, setManagedAssets] = useState<ManagedAsset[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [importing, setImporting] = useState(false);
  const inputId = 'asset-import-input';
  useEffect(() => {
    if (!workspaceId || !projectId) return undefined;
    let cancelled = false;
    const request = getDesktopApi().listAssets?.({ workspaceId, projectId });
    void request?.then((result) => { if (!cancelled && result) setManagedAssets(result); }).catch(() => notify?.(t(locale, '素材读取失败', 'Could not load assets')));
    return () => { cancelled = true; };
  }, [locale, notify, projectId, workspaceId]);
  const importFiles = async (files: FileList | null): Promise<void> => {
    if (!files || !workspaceId || !projectId || readOnly) return;
    setImporting(true);
    try {
      const items = await Promise.all(Array.from(files).map(async (file) => ({ name: file.name, mimeType: file.type || undefined, data: await file.arrayBuffer() })));
      const results = await getDesktopApi().importAssets?.({ workspaceId, projectId, items });
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
  const usingManagedAssets = Boolean(workspaceId && projectId);
  const displayAssets = usingManagedAssets ? managedAssets.map(managedAssetToItem) : assets;
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
  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(undefined);
    if (!selected || !workspaceId || !projectId || selected.managed === false) return () => { cancelled = true; };
    const request = getDesktopApi().readAsset?.({ workspaceId, projectId, assetId: selected.id });
    void request?.then((bytes) => {
      if (!bytes || cancelled || typeof URL === 'undefined') return;
      const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/*' }));
      setPreviewUrl(url);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId, selected?.id, selected?.managed, workspaceId]);
  return (
    <section className="page-content library-page">
      <PageHeader
        title={t(locale, '素材库', 'Assets')}
        eyebrow={t(locale, '受管素材', 'Managed assets')}
        description={t(
          locale,
          usingManagedAssets ? '浏览当前项目素材的来源、格式、用途与受管状态。' : '浏览示例素材的来源、格式、用途与受管状态。',
          usingManagedAssets ? 'Browse source, format, usage and managed state for this project.' : 'Browse source, format, usage and managed state for example assets.',
        )}
      >
        {usingManagedAssets && <>
          <input id={inputId} type="file" multiple hidden onChange={(event) => { void importFiles(event.target.files); event.currentTarget.value = ''; }} />
          <Button icon="upload" disabled={readOnly || importing} onClick={() => document.getElementById(inputId)?.click()}>{importing ? t(locale, '导入中', 'Importing') : t(locale, '导入', 'Import')}</Button>
        </>}
      </PageHeader>
      <div className="asset-toolbar">
        <label className="search-control">
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
        <Field label={t(locale, '类型', 'Type')}>
          <select
            value={type}
            onChange={(event) => onTypeChange(event.target.value as AssetType)}
          >
            <option value="all">{t(locale, '全部', 'All')}</option>
            <option value="image">{t(locale, '图像', 'Images')}</option>
            <option value="logo">{t(locale, '标志', 'Logos')}</option>
            <option value="texture">{t(locale, '纹理', 'Textures')}</option>
          </select>
        </Field>
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
        <span className="result-count">
          {filteredAssets.length} {t(locale, '项', 'items')}
        </span>
      </div>
      <div className="library-split">
        <div className={`asset-collection asset-collection--${layout}`}>
          {filteredAssets.length ? (
            filteredAssets.map((item) => (
              <button
                type="button"
                className={`asset-card ${selected.id === item.id ? 'is-selected' : ''}`}
                key={item.id}
                onClick={() => onSelect(item.id)}
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
          ) : (
            <EmptyState
              icon="search"
              title={t(locale, '没有匹配素材', 'No matching assets')}
              description={t(
                locale,
                '调整名称或类型筛选。',
                'Change the name or type filter.',
              )}
            />
          )}
        </div>
        {selected ? <aside
          className="details-panel asset-details"
          aria-label={t(locale, '素材详情', 'Asset details')}
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
          <p className="panel-note">
            <Icon name="lock" size={15} />
            {t(
              locale,
              usingManagedAssets ? '受管原图保留在当前工作区，外部引用不会自动下载。' : '此页只浏览示例元数据，不读取或写入本机文件。',
              usingManagedAssets ? 'Managed originals stay in this workspace; external references are not downloaded automatically.' : 'This page only browses example metadata and does not read or write local files.',
            )}
          </p>
        </aside> : <div className="details-panel asset-details"><EmptyState icon="image" title={t(locale, '暂无素材', 'No assets yet')} description={t(locale, '导入素材后会显示在这里。', 'Import assets to see them here.')} /></div>}
      </div>
    </section>
  );
};

const BrandsPage = ({
  locale,
  selectedId,
  onSelect,
  workspaceId,
}: {
  locale: Locale;
  selectedId: string;
  onSelect: (id: string) => void;
  workspaceId?: string;
}) => {
  const [records, setRecords] = useState<Brand[]>(brandRecords);
  const [editor, setEditor] = useState<Brand | null>(null);
  const [deletePending, setDeletePending] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  useEffect(() => {
    let cancelled = false;
    if (!workspaceId) { setRecords(brandRecords); setLoading(false); return () => { cancelled = true; }; }
    setLoading(true);
    const request = getDesktopApi().loadBrandState?.(workspaceId);
    void request?.then((state) => {
      if (cancelled) return;
      setRecords(state?.brands?.length ? state.brands : brandRecords);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId]);
  const kits = records.map(recordToKit);
  const selected = kits.find((brand) => brand.id === selectedId) ?? kits[0];
  const selectedRecord = records.find((record) => record.id === selected?.id) ?? records[0];
  const persist = async (next: Brand[]): Promise<void> => {
    setRecords(next);
    if (workspaceId) {
      const saved = await getDesktopApi().saveBrandState?.(workspaceId, { brands: next });
      if (!saved) throw new Error('BRAND_SAVE_FAILED');
    }
  };
  const saveBrand = async (brand: Brand): Promise<void> => {
    const next = records.some((record) => record.id === brand.id)
      ? records.map((record) => record.id === brand.id ? brand : record)
      : [brand, ...records];
    try { await persist(next); onSelect(brand.id); setEditor(null); }
    catch { /* keep the editor open so the user can retry */ }
  };
  const removeBrand = async (): Promise<void> => {
    if (!deletePending) return;
    try { await persist(records.filter((record) => record.id !== deletePending.id)); setDeletePending(null); }
    catch { /* keep confirmation open so the user can retry */ }
  };
  if (!selected || loading) return <section className="page-content library-page"><EmptyState icon="palette" title={t(locale, '正在加载', 'Loading')} description={t(locale, '正在读取品牌包。', 'Loading brand kits.')} /></section>;
  return (
    <section className="page-content library-page">
      <PageHeader
        title={t(locale, '品牌包', 'Brand kits')}
        eyebrow={t(locale, '工作区约束', 'Workspace constraints')}
        description={t(
          locale,
          '查看品牌原件、语气与固定文案；项目继续使用创建时的快照。',
          'Review brand originals, voice and fixed copy; projects continue using their creation-time snapshot.',
        )}
      />
      <div className="library-split library-split--brand">
        <div
          className="brand-list"
          aria-label={t(locale, '品牌包列表', 'Brand kit list')}
        >
        {kits.map((brand, index) => (
            <button
              type="button"
              key={brand.id}
              onClick={() => onSelect(brand.id)}
              aria-pressed={brand.id === selected.id}
              className={`brand-row ${brand.id === selected.id ? 'is-selected' : ''}`}
            >
              <span className={`brand-monogram brand-monogram--${index + 1}`}>
                {localize(locale, brand.name).slice(0, 1)}
              </span>
              <span>
                <strong>{localize(locale, brand.name)}</strong>
                <small>{localize(locale, brand.description)}</small>
              </span>
              <Badge>{brand.version}</Badge>
              <Icon name="chevron-right" size={17} />
            </button>
          ))}
          <div className="list-footnote">
            <Icon name="circle-help" size={16} />
            <p>
              {t(
                locale,
                '品牌包与设计师偏好分别管理，冲突时会显示具体字段。',
                'Brand rules and designer preferences remain separate; conflicts identify the affected field.',
              )}
            </p>
          </div>
        </div>
        <aside
          className="details-panel brand-details"
          aria-label={t(locale, '品牌详情', 'Brand details')}
        >
          <div className="brand-lockup">
            <span className="brand-wordmark">
              {localize(locale, selected.name)}
            </span>
            <small>
              {selected.version} ·{' '}
              {t(locale, '当前品牌原件', 'Current brand original')}
            </small>
          </div>
          <h2>{localize(locale, selected.name)}</h2>
          <p className="details-lede">
            {localize(locale, selected.description)}
          </p>
          <div
            className="color-row"
            aria-label={t(locale, '品牌色', 'Brand colors')}
          >
            <span className="brand-color brand-color--primary" />
            <span className="brand-color brand-color--secondary" />
            <span className="brand-color brand-color--tertiary" />
            <span className="brand-color brand-color--surface" />
          </div>
          <dl className="details-list">
            <DetailRow label={t(locale, '字体', 'Typography')}>
              {localize(locale, selected.font)}
            </DetailRow>
            <DetailRow label={t(locale, '语气', 'Voice')}>
              {localize(locale, selected.tone)}
            </DetailRow>
            <DetailRow label={t(locale, '固定文案', 'Fixed copy')}>
              <q>{localize(locale, selected.copy)}</q>
            </DetailRow>
            <DetailRow label={t(locale, '项目使用', 'Project usage')}>
              {selected.id === 'spring'
                ? t(locale, '1 个项目 · 快照 v2', '1 project · snapshot v2')
                : t(locale, '1 个项目 · 快照 v1', '1 project · snapshot v1')}
            </DetailRow>
          </dl>
          <p className="panel-note">
            <Icon name="history" size={15} />
            {t(
              locale,
              workspaceId ? '项目继续使用创建时保存的品牌快照。' : '示例项目不会自动升级到当前品牌版本。',
              workspaceId ? 'Projects continue using their creation-time brand snapshot.' : 'Example projects are not automatically upgraded to the current brand version.',
            )}
          </p>
          {workspaceId && <div className="dialog-actions brand-actions">
            <Button icon="pencil" onClick={() => { if (selectedRecord) setEditor(selectedRecord); }}>{t(locale, '编辑', 'Edit')}</Button>
            <Button icon="trash-2" onClick={() => { if (selectedRecord) setDeletePending(selectedRecord); }}>{t(locale, '删除', 'Delete')}</Button>
          </div>}
        </aside>
      </div>
      {workspaceId && <div className="brand-create-row"><Button variant="secondary" icon="plus" onClick={() => setEditor({ id: `brand-${crypto.randomUUID()}`, name: '', version: 'v1', logo: '', colorPalette: [], fonts: [], tone: '', fixedCopy: '', sizes: [] })}>{t(locale, '新建', 'New')}</Button></div>}
      {editor && <Modal title={editor.name ? t(locale, '编辑品牌', 'Edit brand') : t(locale, '新建品牌', 'New brand')} locale={locale} onClose={() => setEditor(null)}><BrandEditor brand={editor} locale={locale} onSave={(brand) => { void saveBrand(brand); }} /></Modal>}
      {deletePending && <Modal title={t(locale, '删除品牌', 'Delete brand')} locale={locale} onClose={() => setDeletePending(null)}><p className="muted">{t(locale, `确认删除 ${deletePending.name ?? deletePending.id}？`, `Delete ${deletePending.name ?? deletePending.id}?`)}</p><div className="dialog-actions"><Button onClick={() => setDeletePending(null)}>{t(locale, '取消', 'Cancel')}</Button><Button variant="primary" icon="trash-2" onClick={() => { void removeBrand(); }}>{t(locale, '删除', 'Delete')}</Button></div></Modal>}
    </section>
  );
};

const ConnectionsPage = ({
  locale,
  navigate,
}: Pick<PageProps, 'locale' | 'navigate'>) => {
  const [connectionState, setConnectionState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    const checks = availableConnections.map(async (connection) => [connection.id, await getDesktopApi().hasCredential?.(connection.id) ?? false] as const);
    void Promise.all(checks).then((entries) => { if (!cancelled) setConnectionState(Object.fromEntries(entries)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const connections = availableConnections.map((connection) => ({ ...connection, status: connectionState[connection.id] ? 'connected' as const : 'not-configured' as const }));
  return (
  <section className="page-content library-page">
    <PageHeader
      title={t(locale, '模型连接', 'Model connections')}
      eyebrow={t(locale, '本机能力', 'Local capability')}
      description={t(
        locale,
        '连接由本机适配器提供；项目与密钥不会进入示例数据。',
        'Connections are provided by local adapters; projects and keys never enter example data.',
      )}
    />
    <div className="connection-layout">
      <EmptyState
        icon="plug"
        title={t(locale, '尚未连接模型', 'No models connected')}
        description={t(
          locale,
          '当前仍可浏览示例、编辑画布与配置导出。连接模型后即可提交真实任务。',
          'You can still browse the example, edit the canvas and configure delivery. Connect a model to submit real tasks.',
        )}
      >
        <Button
          variant="secondary"
          icon="settings"
          onClick={() => navigate('settings')}
        >
          {t(locale, '查看设置', 'View settings')}
        </Button>
      </EmptyState>
      <ProviderSettings
        locale={locale}
        connections={connections}
        onCheckCredential={async (connectionId) => getDesktopApi().hasCredential?.(connectionId) ?? false}
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
      <div className="capability-matrix">
        <div className="matrix-heading">
          <span>{t(locale, '能力', 'Capability')}</span>
          <span>{t(locale, '连接状态', 'Connection state')}</span>
        </div>
        {[
          ['message-square', t(locale, '对话', 'Conversation')],
          ['eye', t(locale, '视觉分析', 'Vision analysis')],
          ['image', t(locale, '图像生成', 'Image generation')],
          ['wand-sparkles', t(locale, '图像编辑', 'Image editing')],
        ].map(([icon, label]) => (
          <div className="matrix-row" key={label}>
            <span>
              <Icon name={icon} size={17} />
              {label}
            </span>
            <Badge tone={connectionState['openai-compatible'] ? 'success' : ''}>{connectionState['openai-compatible'] ? t(locale, '已连接', 'Connected') : t(locale, '未配置', 'Not configured')}</Badge>
          </div>
        ))}
      </div>
    </div>
    <p className="page-footnote">
      <Icon name="lock" size={15} />
      {t(
        locale,
        '此页面不收集密钥，也不会伪装连接检测。状态只显示本机安全存储中的配置结果。',
        'This page does not collect keys or simulate checks. Status reflects configuration in local secure storage.',
      )}
    </p>
  </section>
  );
};

const TasksPage = ({
  locale,
  navigate,
  workspaceId,
}: Pick<PageProps, 'locale' | 'navigate'> & { workspaceId?: string }) => {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    if (!workspaceId) {
      setTasks([]);
      return () => { cancelled = true; };
    }
    const request = getDesktopApi().listTasks?.(workspaceId);
    if (!request) {
      setTasks([]);
      return () => { cancelled = true; };
    }
    void request.then((stored) => {
      if (cancelled) return;
      if (!stored) {
        setLoadFailed(true);
        return;
      }
      setTasks(stored);
    }).catch(() => {
      if (!cancelled) setLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, [workspaceId]);
  const queued = tasks.filter((task) => task.state === 'queued').length;
  const running = tasks.filter((task) => task.state === 'running').length;
  const stopTask = async (taskId: string): Promise<void> => {
    if (!workspaceId) return;
    const stopped = await getDesktopApi().cancelTask?.(workspaceId, taskId);
    if (!stopped) return;
    setTasks((current) => current.map((task) => task.id === taskId
      ? { ...task, state: 'cancelled', cancelRequested: true, updatedAt: new Date().toISOString() }
      : task));
  };
  const retryTask = async (taskId: string): Promise<void> => {
    if (!workspaceId) return;
    const retried = await getDesktopApi().retryTask?.(workspaceId, taskId);
    if (!retried) return;
    setTasks((current) => [...current, retried]);
  };
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
    <div className="task-summary">
      <div>
        <span>{t(locale, '排队', 'Queued')}</span>
          <strong>{queued}</strong>
      </div>
      <div>
        <span>{t(locale, '处理中', 'Running')}</span>
          <strong>{running}</strong>
      </div>
      <div>
        <span>{t(locale, '本次会话', 'This session')}</span>
          <strong>{tasks.length}</strong>
      </div>
    </div>
    {loadFailed ? <EmptyState
      icon="circle-alert"
      title={t(locale, '任务读取失败', 'Could not load tasks')}
      description={t(locale, '请重试，原有任务不会被覆盖。', 'Retry without overwriting existing task records.')}
    /> : tasks.length > 0 ? <div className="task-list" aria-label={t(locale, '任务列表', 'Task list')}>
          {tasks.map((task) => <article className="task-row" key={task.id}>
            <div>
              <strong>{task.capability ?? t(locale, '模型任务', 'Model task')}</strong>
              <small>{task.source?.id ?? task.requestId}</small>
              {task.requestText && <small>{task.requestText}</small>}
              {task.result?.imageCount !== undefined && <small>{t(locale, `${task.result.imageCount} 张图`, `${task.result.imageCount} images`)}</small>}
              {task.result?.cost !== undefined && task.result.cost !== null && <small>{t(locale, `费用 ${task.result.cost.toFixed(2)}`, `Cost ${task.result.cost.toFixed(2)}`)}</small>}
            </div>
        <Badge tone={task.state === 'failed' ? 'warning' : task.state === 'completed' ? 'success' : ''}>
          {task.state === 'queued' ? t(locale, '排队', 'Queued') : task.state === 'running' ? t(locale, '处理中', 'Running') : task.state === 'completed' ? t(locale, '已完成', 'Completed') : task.state === 'cancelled' ? t(locale, '已取消', 'Cancelled') : t(locale, '失败', 'Failed')}
        </Badge>
        {(task.state === 'queued' || task.state === 'running') && <Button variant="secondary" icon="x" onClick={() => { void stopTask(task.id); }}>{t(locale, '停止', 'Stop')}</Button>}
        {(task.state === 'failed' || task.state === 'cancelled') && <Button variant="secondary" icon="rotate-ccw" onClick={() => { void retryTask(task.id); }}>{t(locale, '重试', 'Retry')}</Button>}
      </article>)}
    </div> : <EmptyState
      icon="clock"
      title={t(locale, '没有模型任务', 'No model tasks')}
      description={t(
        locale,
        '示例不会提交真实生成请求。连接模型后，任务会显示来源、提供方、上传范围和可验证状态。',
        'The example does not submit real generation requests. Once connected, tasks show their source, provider, upload scope and verified state.',
      )}
    >
      <Button
        variant="secondary"
        icon="plug"
        onClick={() => navigate('connections')}
      >
        {t(locale, '连接模型', 'Connect models')}
      </Button>
    </EmptyState>}
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
}: {
  locale: Locale;
  project?: Project | null;
  format: DeliveryFormat;
  archiveCopy: boolean;
  navigate: PageProps['navigate'];
  onFormatChange: (format: DeliveryFormat) => void;
  onArchiveCopyChange: (value: boolean) => void;
  notify?: (message: string) => void;
}) => {
  const [exporting, setExporting] = useState(false);
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
  const persistedProject = Boolean(project?.workspaceId);
  const exportCurrent = async (): Promise<void> => {
    if (!project?.workspaceId || !project.documentId) return;
    setExporting(true);
    try {
      const api = getDesktopApi();
      const scene = await api.loadDocumentScene?.(project.workspaceId, project.id, project.documentId)
        ?? createScene({ id: project.documentId, width: 1080, height: 1440, layers: [] });
      const result = await api.exportDocument?.({ workspaceId: project.workspaceId, projectId: project.id, documentId: project.documentId, format, scene, ...(format === 'jpeg' ? { background: '#ffffff' } : {}) });
      if (result) notify?.(t(locale, `已导出到 ${result.path}`, `Exported to ${result.path}`));
    } catch {
      notify?.(t(locale, '导出失败，请重试。', 'Export failed. Try again.'));
    } finally { setExporting(false); }
  };
  const exportPackage = async (): Promise<void> => {
    if (!project?.workspaceId) return;
    try {
      const result = await getDesktopApi().exportProjectPackage?.({ workspaceId: project.workspaceId, projectId: project.id });
      if (result) notify?.(t(locale, `项目包已导出到 ${result.path}`, `Project package exported to ${result.path}`));
    } catch {
      notify?.(t(locale, '项目包导出失败', 'Project package export failed'));
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
                persistedProject ? `为${project.name}配置输出格式。左侧显示当前文档原稿。` : `为${project.name}配置输出格式。左侧显示项目示例原稿。`,
                persistedProject ? `Configure output for ${project.enName}. The current document source appears on the left.` : `Configure output for ${project.enName}. The project’s example source artwork appears on the left.`,
              )
            : t(
                locale,
                '选择项目文档后配置输出格式。',
                'Select a project document to configure its output format.',
              )
        }
      >
        {project?.workspaceId && <IconButton name="download" label={t(locale, '导出项目包', 'Export project package')} onClick={() => { void exportPackage(); }} />}
      </PageHeader>
      <div className="delivery-layout">
        {project ? (
          <div className="delivery-preview">
            <ArtworkPreview kind={project.artwork} />
            <div>
              <Badge>{t(locale, '原稿', 'Source')}</Badge>
              <h2>{projectName}</h2>
              <p>
                {(() => {
                  const document = project.documentEntries?.find((entry) => entry.id === project.documentId) ?? project.documentEntries?.[0];
                  const dimensions = `${document?.width ?? 1080} × ${document?.height ?? 1440}`;
                  return t(locale, `${dimensions} 像素 · sRGB`, `${dimensions} px · sRGB`);
                })()}
              </p>
              <small className="source-note">
                  {t(locale, '导出将读取当前文档场景。', 'Export reads the current document scene.')}
              </small>
            </div>
          </div>
        ) : (
          <div className="delivery-preview delivery-preview--empty">
            <EmptyState
              icon="file-image"
              title={t(locale, '选择文档', 'Select a document')}
              description={t(
                locale,
                '从项目中打开一份文档，再返回这里配置交付预览。',
                'Open a document from a project, then return here to configure its delivery preview.',
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
        <div className="delivery-config">
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
              <select value="example" disabled>
                <option value="example">
                  {t(locale, persistedProject ? '当前文档' : '示例原稿', persistedProject ? 'Current document' : 'Example source artwork')}
                </option>
              </select>
            </Field>
            <Field label={t(locale, '颜色空间', 'Color space')}>
              <select value="srgb" disabled>
                <option value="srgb">
                  {t(locale, 'sRGB（首版）', 'sRGB (first release)')}
                </option>
              </select>
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
                  persistedProject ? '导出会读取当前文档，并可选择归档副本。' : '仅配置选项；示例不会写入 exports 目录。',
                  persistedProject ? 'Export reads the current document and can archive a copy.' : 'Configuration only; the example does not write to the exports directory.',
                )}
              </small>
            </span>
          </label>
          <div className="export-bar">
            <div>
              <strong>
                {t(locale, '尚未选择目标目录', 'No destination selected')}
              </strong>
              <span>
                {t(
                  locale,
                  persistedProject ? '使用桌面保存对话框写出并校验文件。' : '桌面导出能力接入后才可执行。',
                  persistedProject ? 'Use the desktop save dialog to write and validate the file.' : 'Available after desktop export support is connected.',
                )}
              </span>
            </div>
            <Button variant="primary" icon="download" disabled={!project?.workspaceId || !project.documentId || exporting} onClick={() => { void exportCurrent(); }}>
              {exporting ? t(locale, '处理中', 'Working') : t(locale, '导出', 'Export')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

const StoragePage = ({
  locale,
  tab,
  onTabChange,
  workspaceId,
  readOnly = false,
  onWorkspaceChange,
  notify,
}: {
  locale: Locale;
  tab: StorageTab;
  onTabChange: (tab: StorageTab) => void;
  workspaceId?: string;
  readOnly?: boolean;
  onWorkspaceChange?: (workspace: WorkspaceDescriptor) => void;
  notify?: (message: string) => void;
}) => {
  const [trash, setTrash] = useState<TrashedProject[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!workspaceId || readOnly) {
      setTrash([]);
      return () => { cancelled = true; };
    }
    setLoadingTrash(true);
    void getDesktopApi().listTrashedProjects?.(workspaceId).then((entries) => {
      if (!cancelled) setTrash(entries ?? []);
    }).catch(() => {
      if (!cancelled) notify?.(t(locale, '废纸篓读取失败', 'Could not load trash'));
    }).finally(() => {
      if (!cancelled) setLoadingTrash(false);
    });
    return () => { cancelled = true; };
  }, [locale, notify, readOnly, workspaceId]);
  const restore = async (projectId: string): Promise<void> => {
    if (!workspaceId || readOnly) return;
    setBusy(true);
    try {
      const result = await getDesktopApi().restoreProjectFromTrash?.({ workspaceId, projectId });
      if (result) {
        setTrash((current) => current.filter((entry) => entry.projectId !== projectId));
        notify?.(t(locale, '项目已恢复', 'Project restored'));
      }
    } catch {
      notify?.(t(locale, '恢复失败，请重试', 'Restore failed; try again'));
    } finally { setBusy(false); }
  };
  const purge = async (projectId: string): Promise<void> => {
    if (!workspaceId || readOnly || !window.confirm(t(locale, '永久删除此项目？', 'Permanently delete this project?'))) return;
    setBusy(true);
    try {
      const result = await getDesktopApi().purgeProjectFromTrash?.({ workspaceId, projectId });
      if (result) {
        setTrash((current) => current.filter((entry) => entry.projectId !== projectId));
        notify?.(t(locale, '项目已删除', 'Project deleted'));
      }
    } catch {
      notify?.(t(locale, '删除失败，项目可能仍被引用', 'Delete failed; the project may still be referenced'));
    } finally { setBusy(false); }
  };
  const createBackup = async (): Promise<void> => {
    if (!workspaceId || readOnly) return;
    setBusy(true);
    try {
      const destination = await getDesktopApi().chooseWorkspaceDirectory();
      if (!destination) return;
      const artifact = await getDesktopApi().createWorkspaceBackup?.(workspaceId, destination);
      if (artifact) {
        setBackupPath(artifact.directory);
        notify?.(t(locale, '备份已创建', 'Backup created'));
      }
    } catch {
      notify?.(t(locale, '备份失败，请重试', 'Backup failed; try again'));
    } finally { setBusy(false); }
  };
  const restoreBackup = async (): Promise<void> => {
    if (readOnly) return;
    setBusy(true);
    try {
      const backupDirectory = await getDesktopApi().chooseWorkspaceDirectory();
      if (!backupDirectory) return;
      const destinationParentDirectory = await getDesktopApi().chooseWorkspaceDirectory();
      if (!destinationParentDirectory) return;
      const restored = await getDesktopApi().restoreWorkspaceBackup?.({ backupDirectory, destinationParentDirectory });
      if (!restored) return;
      const opened = await getDesktopApi().openWorkspace?.(restored.directory);
      if (opened) {
        onWorkspaceChange?.(opened);
        notify?.(t(locale, '备份已恢复', 'Backup restored'));
      }
    } catch {
      notify?.(t(locale, '恢复失败，请重试', 'Restore failed; try again'));
    } finally { setBusy(false); }
  };
  const hasWorkspace = Boolean(workspaceId);
  return (
  <section className="page-content library-page">
    <PageHeader
      title={t(locale, '工作区管理', 'Workspace management')}
      eyebrow={t(locale, '本地内容', 'Local content')}
      description={t(
        locale,
        hasWorkspace ? '检查废纸篓与本地备份状态。' : '打开工作区后管理废纸篓与备份。',
        hasWorkspace ? 'Review trash and local backup state.' : 'Open a workspace to manage trash and backups.',
      )}
    />
    <div
      className="tab-bar"
      aria-label={t(locale, '工作区管理', 'Workspace management')}
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
        {!hasWorkspace || readOnly ? <EmptyState
          icon="trash-2"
          title={readOnly ? t(locale, '只读工作区', 'Read-only workspace') : t(locale, '废纸篓为空', 'Trash is empty')}
          description={t(
            locale,
            readOnly ? '只读模式下不能修改废纸篓。' : '删除的项目、文档和素材会显示原位置、删除时间与引用限制。',
            readOnly ? 'Trash cannot be modified in read-only mode.' : 'Deleted projects, documents and assets show their original location, deletion time and reference limits.',
          )}
        /> : loadingTrash ? <p className="storage-loading">{t(locale, '读取中', 'Loading')}</p> : trash.length === 0 ? <EmptyState
          icon="trash-2"
          title={t(locale, '废纸篓为空', 'Trash is empty')}
          description={t(locale, '删除的项目不会自动过期。', 'Deleted projects do not expire automatically.')}
        /> : <div className="trash-list" aria-label={t(locale, '废纸篓项目', 'Trash items')}>
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
              {backupPath ? t(locale, '备份已就绪', 'Backup ready') : t(locale, '尚未配置备份位置', 'No backup destination configured')}
            </h2>
            <p>
              {t(
                locale,
                backupPath ?? t(locale, '备份默认不上传云端。', 'Backups are not uploaded by default.'),
                backupPath ?? 'Backups are not uploaded by default.',
              )}
            </p>
          </div>
          <Badge>{backupPath ? t(locale, '已验证', 'Verified') : t(locale, '未配置', 'Not configured')}</Badge>
        </div>
        <dl className="details-list backup-facts">
          <DetailRow label={t(locale, '上次成功', 'Last success')}>
            {backupPath ? t(locale, '刚刚', 'Just now') : t(locale, '无记录', 'No record')}
          </DetailRow>
          <DetailRow label={t(locale, '目标位置', 'Destination')}>
            {backupPath ?? t(locale, '未选择', 'Not selected')}
          </DetailRow>
          <DetailRow label={t(locale, '备份周期', 'Schedule')}>
            {backupPath ? t(locale, '手动', 'Manual') : t(locale, '未启用', 'Not enabled')}
          </DetailRow>
        </dl>
        <div className="storage-actions">
          <Button icon="download" disabled={!hasWorkspace || readOnly || busy} onClick={() => { void createBackup(); }}>{t(locale, '创建备份', 'Create backup')}</Button>
          <Button icon="upload" disabled={readOnly || busy} onClick={() => { void restoreBackup(); }}>{t(locale, '恢复备份', 'Restore backup')}</Button>
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
  operatorName = '',
  onOperatorNameChange,
}: Pick<
  LibraryPagesProps,
  'locale' | 'theme' | 'navigate' | 'onThemeChange' | 'onLocaleChange'
> & { notify?: (message: string) => void; operatorName?: string; onOperatorNameChange?: (name: string) => void }) => {
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
            <select
              value={locale}
              onChange={(event) => onLocaleChange(event.target.value as Locale)}
            >
              <option value="zh-CN">
                {t(locale, '简体中文', 'Simplified Chinese')}
              </option>
              <option value="en">{t(locale, 'English', 'English')}</option>
            </select>
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
                  '当前没有已配置连接',
                  'No connections are configured',
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
  workspaceId,
  readOnly = false,
  projectId,
  onWorkspaceChange,
  operatorName,
  onOperatorNameChange,
}: LibraryPagesProps) => {
  const [assetQuery, setAssetQuery] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('all');
  const [assetLayout, setAssetLayout] = useState<'grid' | 'list'>('grid');
  const [selectedAsset, setSelectedAsset] = useState(assets[0].id);
  const [selectedBrand, setSelectedBrand] = useState(brands[0].id);
  const [deliveryFormat, setDeliveryFormat] = useState<DeliveryFormat>('png');
  const [archiveCopy, setArchiveCopy] = useState(false);
  const [storageTab, setStorageTab] = useState<StorageTab>('trash');
  const pages: Record<Exclude<View, 'projects'>, ReactNode> = {
    designers: (
      <DesignerLibrary locale={locale} notify={notify} onUseForNew={onUseForNew} workspaceId={workspaceId} readOnly={readOnly} />
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
        workspaceId={workspaceId}
        projectId={projectId}
        readOnly={readOnly}
        notify={notify}
      />
    ),
    brands: (
      <BrandsPage
        locale={locale}
        selectedId={selectedBrand}
        onSelect={setSelectedBrand}
        workspaceId={workspaceId}
      />
    ),
    connections: <ConnectionsPage locale={locale} navigate={navigate} />,
    tasks: <TasksPage locale={locale} navigate={navigate} workspaceId={workspaceId} />,
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
      />
    ),
    storage: (
      <StoragePage
        locale={locale}
        tab={storageTab}
        onTabChange={setStorageTab}
        workspaceId={workspaceId}
        readOnly={readOnly}
        onWorkspaceChange={onWorkspaceChange}
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
      />
    ),
  };
  return (
    <>
      {pages[view]}
    </>
  );
};

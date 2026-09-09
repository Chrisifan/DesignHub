import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';

import type { Locale } from '../i18n';
import type { PageProps, Project, Theme, View } from './types';
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
import './library.css';

type LibraryPagesProps = PageProps & {
  view: Exclude<View, 'projects'>;
  theme: Theme;
  onThemeChange: (value: Theme) => void;
  onLocaleChange: (value: Locale) => void;
  deliveryProject?: Project | null;
};

type Localized = { zh: string; en: string };
type DesignerProfile = {
  id: string;
  name: Localized;
  signature: Localized;
  summary: Localized;
  rule: Localized;
  version: string;
  kind: 'built-in' | 'published';
  artwork: 'market' | 'objects' | 'type';
  accent: 'primary' | 'secondary' | 'tertiary';
};
type DesignerDraft = {
  name: string;
  signature: string;
  summary: string;
  rule: string;
};
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
type DeliveryFormat = 'png' | 'jpeg' | 'pdf';
type StorageTab = 'trash' | 'backup';

const designers: DesignerProfile[] = [
  {
    id: 'paper',
    name: { zh: '纸感排版', en: 'Paper & Type' },
    signature: { zh: '春间工作室', en: 'Spring Studio' },
    summary: {
      zh: '编辑感网格、温暖纸张与克制的装饰元素。',
      en: 'Editorial grids, warm paper and restrained ornament.',
    },
    rule: {
      zh: '优先建立文字层级，保留明显留白。',
      en: 'Build type hierarchy first and preserve visible whitespace.',
    },
    version: 'v1.4',
    kind: 'published',
    artwork: 'market',
    accent: 'primary',
  },
  {
    id: 'commerce',
    name: { zh: '清晰商业', en: 'Clear Commerce' },
    signature: { zh: 'DesignHub 示例', en: 'DesignHub Example' },
    summary: {
      zh: '清楚的商品焦点、直接的信息组织与稳定节奏。',
      en: 'Clear product focus, direct information and steady rhythm.',
    },
    rule: {
      zh: '主体优先，背景只承担对比与场景。',
      en: 'Prioritize the subject; use backgrounds for contrast and context.',
    },
    version: 'v2.1',
    kind: 'published',
    artwork: 'objects',
    accent: 'tertiary',
  },
  {
    id: 'general',
    name: { zh: '通用设计师', en: 'General Designer' },
    signature: { zh: '内置档案', en: 'Built-in profile' },
    summary: {
      zh: '平衡构图、可靠层级与适合继续编辑的起点。',
      en: 'Balanced composition, reliable hierarchy and editable starting points.',
    },
    rule: {
      zh: '遵循品牌要求，无法判断时保持简洁。',
      en: 'Follow brand constraints and stay simple when uncertain.',
    },
    version: 'v1.0',
    kind: 'built-in',
    artwork: 'type',
    accent: 'secondary',
  },
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

const localize = (locale: Locale, value: Localized): string =>
  t(locale, value.zh, value.en);
const createDesignerDraft = (
  locale: Locale,
  profile: DesignerProfile,
): DesignerDraft => ({
  name: localize(locale, profile.name),
  signature: localize(locale, profile.signature),
  summary: localize(locale, profile.summary),
  rule: localize(locale, profile.rule),
});

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

const DesignerDraftModal = ({
  locale,
  draft,
  mode,
  onDraftChange,
  onClose,
  onRetain,
}: {
  locale: Locale;
  draft: DesignerDraft;
  mode: 'new' | 'edit';
  onDraftChange: (draft: DesignerDraft) => void;
  onClose: () => void;
  onRetain: () => void;
}) => {
  const setDraftField =
    (field: keyof DesignerDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onDraftChange({ ...draft, [field]: event.target.value });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRetain();
  };
  const previewName = draft.name || t(locale, '未命名档案', 'Untitled profile');
  return (
    <Modal
      title={
        mode === 'new'
          ? t(locale, '创建设计师', 'Create designer')
          : t(locale, '编辑设计师', 'Edit designer')
      }
      locale={locale}
      onClose={onClose}
      wide
    >
      <form className="designer-editor" onSubmit={submit}>
        <div className="designer-form">
          <p className="panel-label">
            {t(locale, '档案草稿', 'Profile draft')}
          </p>
          <Field label={t(locale, '名称', 'Name')}>
            <input
              value={draft.name}
              onChange={setDraftField('name')}
              placeholder={t(
                locale,
                '例如：克制编辑感',
                'For example: Quiet editorial',
              )}
            />
          </Field>
          <Field
            label={t(locale, '署名', 'Signature')}
            hint={t(
              locale,
              '仅作为创作溯源，不代表真人身份。',
              'Used for creative attribution; it does not represent a real person.',
            )}
          >
            <input
              value={draft.signature}
              onChange={setDraftField('signature')}
            />
          </Field>
          <Field label={t(locale, '风格说明', 'Style description')}>
            <textarea
              rows={3}
              value={draft.summary}
              onChange={setDraftField('summary')}
            />
          </Field>
          <Field label={t(locale, '创作规则', 'Creative rules')}>
            <textarea
              rows={3}
              value={draft.rule}
              onChange={setDraftField('rule')}
            />
          </Field>
        </div>
        <aside
          className="designer-draft-preview"
          aria-label={t(locale, '档案预览', 'Profile preview')}
        >
          <span className="profile-mark">
            <Icon name="sparkles" size={22} />
          </span>
          <p className="section-kicker">
            {t(locale, '会话草稿', 'Session draft')}
          </p>
          <h3>{previewName}</h3>
          <p>
            {draft.summary ||
              t(
                locale,
                '在左侧描述这个档案的视觉判断。',
                'Describe this profile’s visual judgement on the left.',
              )}
          </p>
          <div className="draft-rule">
            <span>{t(locale, '规则', 'Rule')}</span>
            {draft.rule || t(locale, '尚未填写', 'Not provided')}
          </div>
          <small>
            {t(
              locale,
              '关闭后草稿仍保留在本次示例会话中，不会写入磁盘。',
              'Closing keeps the draft in this example session; nothing is written to disk.',
            )}
          </small>
        </aside>
        <div className="dialog-actions designer-editor-actions">
          <Button variant="ghost" onClick={onClose}>
            {t(locale, '关闭', 'Close')}
          </Button>
          <Button variant="primary" icon="check" type="submit">
            {t(locale, '保留', 'Keep draft')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const DesignersPage = ({
  locale,
  selectedId,
  onSelect,
  onCreate,
  onEdit,
}: {
  locale: Locale;
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (profile: DesignerProfile) => void;
}) => {
  const selected =
    designers.find((profile) => profile.id === selectedId) ?? designers[0];
  return (
    <section className="page-content library-page">
      <PageHeader
        title={t(locale, '设计师', 'Designers')}
        eyebrow={t(locale, '创作档案', 'Creative profiles')}
        description={t(
          locale,
          '管理示例中的创作偏好、规则与版本。档案代表 AI 创作身份。',
          'Manage creative preferences, rules and versions in this example. Profiles represent AI creative identities.',
        )}
      >
        <Button variant="primary" icon="plus" onClick={onCreate}>
          {t(locale, '创建', 'Create')}
        </Button>
      </PageHeader>
      <div className="library-split library-split--wide">
        <div
          className="profile-library"
          aria-label={t(locale, '设计师档案', 'Designer profiles')}
        >
          {designers.map((profile) => (
            <button
              type="button"
              className={`profile-card ${selected.id === profile.id ? 'is-selected' : ''}`}
              key={profile.id}
              onClick={() => onSelect(profile.id)}
              aria-pressed={selected.id === profile.id}
            >
              <ArtworkPreview
                kind={profile.artwork}
                className="profile-artwork"
              />
              <span className={`profile-mark profile-mark--${profile.accent}`}>
                <Icon name="sparkles" size={17} />
              </span>
              <span className="profile-copy">
                <strong>{localize(locale, profile.name)}</strong>
                <span>{localize(locale, profile.summary)}</span>
                <small>
                  {profile.version} ·{' '}
                  {profile.kind === 'built-in'
                    ? t(locale, '内置', 'Built-in')
                    : t(locale, '已发布', 'Published')}
                </small>
              </span>
            </button>
          ))}
        </div>
        <aside
          className="details-panel"
          aria-label={t(locale, '设计师详情', 'Designer details')}
        >
          <div className="details-heading">
            <div>
              <p className="section-kicker">
                {selected.version} ·{' '}
                {selected.kind === 'built-in'
                  ? t(locale, '内置档案', 'Built-in profile')
                  : t(locale, '已发布档案', 'Published profile')}
              </p>
              <h2>{localize(locale, selected.name)}</h2>
            </div>
            <Button
              icon="settings"
              variant="secondary"
              onClick={() => onEdit(selected)}
            >
              {t(locale, '编辑', 'Edit')}
            </Button>
          </div>
          <p className="details-lede">{localize(locale, selected.summary)}</p>
          <dl className="details-list">
            <DetailRow label={t(locale, '署名', 'Signature')}>
              {localize(locale, selected.signature)}
            </DetailRow>
            <DetailRow label={t(locale, '创作规则', 'Creative rule')}>
              {localize(locale, selected.rule)}
            </DetailRow>
            <DetailRow label={t(locale, '默认范围', 'Default scope')}>
              {selected.id === 'paper'
                ? t(locale, '春间市集工作区', 'Spring workspace')
                : t(locale, '未设为默认', 'Not a default')}
            </DetailRow>
          </dl>
          <div
            className="sample-strip"
            aria-label={t(locale, '示例作品', 'Sample work')}
          >
            <ArtworkPreview kind={selected.artwork} />
            <ArtworkPreview
              kind={selected.id === 'commerce' ? 'market' : 'type'}
            />
          </div>
          <p className="panel-note">
            <Icon name="history" size={15} />
            {t(
              locale,
              '编辑会建立会话草稿；示例不会发布新版本。',
              'Editing creates a session draft; the example does not publish a new version.',
            )}
          </p>
        </aside>
      </div>
    </section>
  );
};

const AssetVisual = ({ item, locale }: { item: AssetItem; locale: Locale }) =>
  item.type === 'logo' ? (
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
}) => {
  const filteredAssets = useMemo(
    () =>
      assets.filter(
        (item) =>
          (type === 'all' || item.type === type) &&
          localize(locale, item.name)
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      ),
    [locale, query, type],
  );
  const selected = assets.find((item) => item.id === selectedId) ?? assets[0];
  return (
    <section className="page-content library-page">
      <PageHeader
        title={t(locale, '素材库', 'Assets')}
        eyebrow={t(locale, '受管素材', 'Managed assets')}
        description={t(
          locale,
          '浏览示例素材的来源、格式、用途与受管状态。',
          'Browse source, format, usage and managed state for example assets.',
        )}
      >
        <span className="disabled-action">
          <Button icon="upload" disabled>
            {t(locale, '导入', 'Import')}
          </Button>
          <small>
            {t(locale, '需要桌面文件能力', 'Desktop file access required')}
          </small>
        </span>
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
        <aside
          className="details-panel asset-details"
          aria-label={t(locale, '素材详情', 'Asset details')}
        >
          <div className="asset-detail-visual">
            <AssetVisual item={selected} locale={locale} />
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
              <Badge tone="success">
                {t(locale, '受管副本', 'Managed copy')}
              </Badge>
            </DetailRow>
          </dl>
          <p className="panel-note">
            <Icon name="lock" size={15} />
            {t(
              locale,
              '此页只浏览示例元数据，不读取或写入本机文件。',
              'This page only browses example metadata and does not read or write local files.',
            )}
          </p>
        </aside>
      </div>
    </section>
  );
};

const BrandsPage = ({
  locale,
  selectedId,
  onSelect,
}: {
  locale: Locale;
  selectedId: string;
  onSelect: (id: string) => void;
}) => {
  const selected = brands.find((brand) => brand.id === selectedId) ?? brands[0];
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
          {brands.map((brand, index) => (
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
              '示例项目不会自动升级到当前品牌版本。',
              'Example projects are not automatically upgraded to the current brand version.',
            )}
          </p>
        </aside>
      </div>
    </section>
  );
};

const ConnectionsPage = ({
  locale,
  navigate,
}: Pick<PageProps, 'locale' | 'navigate'>) => (
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
          '当前仍可浏览示例、编辑画布与配置导出。连接适配器尚未包含在此 UI 示例中。',
          'You can still browse the example, edit the canvas and configure delivery. Connection adapters are not included in this UI example.',
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
      <div className="capability-matrix">
        <div className="matrix-heading">
          <span>{t(locale, '能力', 'Capability')}</span>
          <span>{t(locale, '连接状态', 'Connection state')}</span>
        </div>
        {[
          ['message-square', t(locale, '对话', 'Conversation')],
          ['image', t(locale, '图像生成', 'Image generation')],
          ['wand-sparkles', t(locale, '图像编辑', 'Image editing')],
        ].map(([icon, label]) => (
          <div className="matrix-row" key={label}>
            <span>
              <Icon name={icon} size={17} />
              {label}
            </span>
            <Badge>{t(locale, '未配置', 'Not configured')}</Badge>
          </div>
        ))}
      </div>
    </div>
    <p className="page-footnote">
      <Icon name="lock" size={15} />
      {t(
        locale,
        '此页面不收集密钥，也不会伪装连接检测。接入受支持适配器后才会显示凭据入口。',
        'This page does not collect keys or simulate connection checks. Credential controls appear only when a supported adapter is available.',
      )}
    </p>
  </section>
);

const TasksPage = ({
  locale,
  navigate,
}: Pick<PageProps, 'locale' | 'navigate'>) => (
  <section className="page-content library-page">
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
        <strong>0</strong>
      </div>
      <div>
        <span>{t(locale, '处理中', 'Running')}</span>
        <strong>0</strong>
      </div>
      <div>
        <span>{t(locale, '本次会话', 'This session')}</span>
        <strong>0</strong>
      </div>
    </div>
    <EmptyState
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
    </EmptyState>
  </section>
);

const DeliveryPage = ({
  locale,
  project,
  format,
  archiveCopy,
  navigate,
  onFormatChange,
  onArchiveCopyChange,
}: {
  locale: Locale;
  project?: Project | null;
  format: DeliveryFormat;
  archiveCopy: boolean;
  navigate: PageProps['navigate'];
  onFormatChange: (format: DeliveryFormat) => void;
  onArchiveCopyChange: (value: boolean) => void;
}) => {
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
  return (
    <section className="page-content library-page">
      <PageHeader
        title={t(locale, '导出交付', 'Delivery')}
        eyebrow={t(locale, '示例原稿', 'Example source artwork')}
        description={
          project
            ? t(
                locale,
                `为${project.name}配置输出格式。左侧显示项目示例原稿。`,
                `Configure output for ${project.enName}. The project’s example source artwork appears on the left.`,
              )
            : t(
                locale,
                '选择项目文档后配置输出格式。',
                'Select a project document to configure its output format.',
              )
        }
      />
      <div className="delivery-layout">
        {project ? (
          <div className="delivery-preview">
            <ArtworkPreview kind={project.artwork} />
            <div>
              <Badge>{t(locale, '原稿', 'Source')}</Badge>
              <h2>{projectName}</h2>
              <p>
                {t(locale, '1080 × 1440 像素 · sRGB', '1080 × 1440 px · sRGB')}
              </p>
              <small className="source-note">
                {t(
                  locale,
                  '工作台编辑不会反映在此缩略图；实际渲染与导出尚未接入。',
                  'Workbench edits are not reflected in this thumbnail; actual rendering and export are not connected.',
                )}
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
              {(['png', 'jpeg', 'pdf'] as DeliveryFormat[]).map((option) => (
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
                  {t(locale, '示例原稿', 'Example source artwork')}
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
                  '仅配置选项；示例不会写入 exports 目录。',
                  'Configuration only; the example does not write to the exports directory.',
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
                  '桌面导出能力接入后才可执行。',
                  'Available after desktop export support is connected.',
                )}
              </span>
            </div>
            <Button variant="primary" icon="download" disabled>
              {t(locale, '导出', 'Export')}
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
}: {
  locale: Locale;
  tab: StorageTab;
  onTabChange: (tab: StorageTab) => void;
}) => (
  <section className="page-content library-page">
    <PageHeader
      title={t(locale, '工作区管理', 'Workspace management')}
      eyebrow={t(locale, '本地内容', 'Local content')}
      description={t(
        locale,
        '检查废纸篓与本地备份状态。示例不访问工作区磁盘。',
        'Review trash and local backup state. The example does not access workspace storage.',
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
        <EmptyState
          icon="trash-2"
          title={t(locale, '废纸篓为空', 'Trash is empty')}
          description={t(
            locale,
            '删除的项目、文档和素材会显示原位置、删除时间与引用限制。内容不会自动过期。',
            'Deleted projects, documents and assets show their original location, deletion time and reference limits. Items do not expire automatically.',
          )}
        />
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
              {t(
                locale,
                '尚未配置备份位置',
                'No backup destination configured',
              )}
            </h2>
            <p>
              {t(
                locale,
                '备份默认不上传云端。需要桌面目录选择和真实校验能力后才能启用。',
                'Backups are not uploaded by default. Desktop folder selection and real verification are required before activation.',
              )}
            </p>
          </div>
          <Badge>{t(locale, '不可用', 'Unavailable')}</Badge>
        </div>
        <dl className="details-list backup-facts">
          <DetailRow label={t(locale, '上次成功', 'Last success')}>
            {t(locale, '无记录', 'No record')}
          </DetailRow>
          <DetailRow label={t(locale, '目标位置', 'Destination')}>
            {t(locale, '未选择', 'Not selected')}
          </DetailRow>
          <DetailRow label={t(locale, '备份周期', 'Schedule')}>
            {t(locale, '未启用', 'Not enabled')}
          </DetailRow>
        </dl>
        <span className="disabled-action disabled-action--left">
          <Button icon="settings" disabled>
            {t(locale, '配置', 'Configure')}
          </Button>
          <small>
            {t(locale, '需要桌面目录能力', 'Desktop folder access required')}
          </small>
        </span>
      </div>
    )}
  </section>
);

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
}: Pick<
  LibraryPagesProps,
  'locale' | 'theme' | 'navigate' | 'onThemeChange' | 'onLocaleChange'
>) => (
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
            <Button disabled>{t(locale, '导出', 'Export')}</Button>
          </div>
        </div>
      </section>
    </div>
  </section>
);

export const LibraryPages = ({
  view,
  locale,
  notify,
  navigate,
  theme,
  onThemeChange,
  onLocaleChange,
  deliveryProject,
}: LibraryPagesProps) => {
  const [selectedDesigner, setSelectedDesigner] = useState(designers[0].id);
  const [newDesignerDraft, setNewDesignerDraft] = useState<DesignerDraft>({
    name: '',
    signature: '',
    summary: '',
    rule: '',
  });
  const [designerEditDrafts, setDesignerEditDrafts] = useState<
    Record<string, DesignerDraft>
  >({});
  const [designerModal, setDesignerModal] = useState<
    { mode: 'new' } | { mode: 'edit'; profileId: string } | null
  >(null);
  const [assetQuery, setAssetQuery] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('all');
  const [assetLayout, setAssetLayout] = useState<'grid' | 'list'>('grid');
  const [selectedAsset, setSelectedAsset] = useState(assets[0].id);
  const [selectedBrand, setSelectedBrand] = useState(brands[0].id);
  const [deliveryFormat, setDeliveryFormat] = useState<DeliveryFormat>('png');
  const [archiveCopy, setArchiveCopy] = useState(false);
  const [storageTab, setStorageTab] = useState<StorageTab>('trash');
  const openNewDesigner = () => setDesignerModal({ mode: 'new' });
  const openDesignerEdit = (profile: DesignerProfile) => {
    setDesignerEditDrafts((drafts) =>
      drafts[profile.id]
        ? drafts
        : { ...drafts, [profile.id]: createDesignerDraft(locale, profile) },
    );
    setDesignerModal({ mode: 'edit', profileId: profile.id });
  };
  const retainDesignerDraft = () => {
    setDesignerModal(null);
    notify(
      t(
        locale,
        '草稿保留在本次示例会话中',
        'Draft kept in this example session',
      ),
    );
  };
  const activeDesignerProfile =
    designerModal?.mode === 'edit'
      ? designers.find((profile) => profile.id === designerModal.profileId)
      : undefined;
  const activeDesignerDraft =
    designerModal?.mode === 'edit'
      ? (designerEditDrafts[designerModal.profileId] ??
        (activeDesignerProfile
          ? createDesignerDraft(locale, activeDesignerProfile)
          : newDesignerDraft))
      : newDesignerDraft;
  const updateActiveDesignerDraft = (draft: DesignerDraft) => {
    if (designerModal?.mode === 'edit')
      setDesignerEditDrafts((drafts) => ({
        ...drafts,
        [designerModal.profileId]: draft,
      }));
    else setNewDesignerDraft(draft);
  };
  const pages: Record<Exclude<View, 'projects'>, ReactNode> = {
    designers: (
      <DesignersPage
        locale={locale}
        selectedId={selectedDesigner}
        onSelect={setSelectedDesigner}
        onCreate={openNewDesigner}
        onEdit={openDesignerEdit}
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
      />
    ),
    brands: (
      <BrandsPage
        locale={locale}
        selectedId={selectedBrand}
        onSelect={setSelectedBrand}
      />
    ),
    connections: <ConnectionsPage locale={locale} navigate={navigate} />,
    tasks: <TasksPage locale={locale} navigate={navigate} />,
    delivery: (
      <DeliveryPage
        locale={locale}
        project={deliveryProject}
        format={deliveryFormat}
        archiveCopy={archiveCopy}
        navigate={navigate}
        onFormatChange={setDeliveryFormat}
        onArchiveCopyChange={setArchiveCopy}
      />
    ),
    storage: (
      <StoragePage
        locale={locale}
        tab={storageTab}
        onTabChange={setStorageTab}
      />
    ),
    settings: (
      <SettingsPage
        locale={locale}
        theme={theme}
        navigate={navigate}
        onThemeChange={onThemeChange}
        onLocaleChange={onLocaleChange}
      />
    ),
  };
  return (
    <>
      {pages[view]}
      {designerModal && (
        <DesignerDraftModal
          locale={locale}
          draft={activeDesignerDraft}
          mode={designerModal.mode}
          onDraftChange={updateActiveDesignerDraft}
          onClose={() => setDesignerModal(null)}
          onRetain={retainDesignerDraft}
        />
      )}
    </>
  );
};

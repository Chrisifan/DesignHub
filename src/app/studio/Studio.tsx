import { useEffect, useState, type FormEvent } from 'react';
import { getMessages, type Locale } from '../i18n';
import { WindowBar } from '../shell/WindowBar';
import { exampleProjects } from './examples';
import { LibraryPages } from './LibraryPages';
import { DesignerHero } from './DesignerHero';
import { NewDesignPage } from './NewDesignPage';
import { PersonaArtwork } from './PersonaArtwork';
import { getPersona } from './personas';
import { Workbench } from './Workbench';
import {
  ArtworkPreview,
  Badge,
  Button,
  EmptyState,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  t,
} from './ui';
import type { NewDesignDraft, Project, StudioSurface, Theme, View } from './types';
import '../styles/studio.css';

const navigation: { view: View; icon: string; zh: string; en: string }[] = [
  { view: 'projects', icon: 'layout-grid', zh: '项目库', en: 'Projects' },
  { view: 'designers', icon: 'users', zh: '设计师', en: 'Designers' },
  { view: 'assets', icon: 'image', zh: '素材库', en: 'Assets' },
  { view: 'brands', icon: 'palette', zh: '品牌包', en: 'Brand kits' },
  { view: 'connections', icon: 'plug', zh: '模型连接', en: 'Connections' },
  { view: 'tasks', icon: 'clock', zh: '模型任务', en: 'Model tasks' },
  { view: 'delivery', icon: 'download', zh: '导出交付', en: 'Delivery' },
  { view: 'storage', icon: 'hard-drive', zh: '工作区管理', en: 'Workspace' },
  { view: 'settings', icon: 'settings', zh: '设置', en: 'Settings' },
];

type StudioProps = {
  locale: Locale;
  theme: Theme;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: Theme) => void;
  onExit: () => void;
};

export const Studio = ({
  locale,
  theme,
  onLocaleChange,
  onThemeChange,
  onExit,
}: StudioProps) => {
  const [view, setView] = useState<View>('projects');
  const [surface, setSurface] = useState<StudioSurface>('projects');
  const [projects, setProjects] = useState(exampleProjects);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [display, setDisplay] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<Project | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [deliveryProject, setDeliveryProject] = useState<Project | null>(null);
  const [dialog, setDialog] = useState<'workspace' | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<NewDesignDraft>({
    name: '',
    goal: '',
    brief: '',
    personaId: 'paper-type',
    size: '1080 × 1440',
    mode: 'manual',
  });
  const navigate = (next: View) => {
    setView(next);
    setSurface(next);
    setDocumentOpen(false);
    setSelected(null);
  };
  const notify = (message: string) => setNotice(message);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const title = navigation.find((item) => item.view === view)!;
  const nativeControlSide = navigator.userAgent.includes('Mac')
    ? 'left'
    : 'right';
  const visibleProjects = projects.filter(
    (project) =>
      (filter === 'all' ||
        Boolean(project.archived) === (filter === 'archived')) &&
      `${project.name} ${project.enName} ${project.description}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const openProject = (project: Project) => {
    setSelected(project);
    setSurface('projects');
    setDocumentOpen(false);
    setView('projects');
  };
  const createProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const project: Project = {
      id: `preview-${crypto.randomUUID()}`,
      name: draft.name.trim(),
      enName: draft.name.trim(),
      description:
        draft.goal || draft.brief ||
        t(locale, '本次预览中的项目草稿', 'A project draft for this preview'),
      enDescription: draft.goal || draft.brief || 'A project draft for this preview',
      designers: [getPersona(draft.personaId)?.name.zh ?? '纸感排版'],
      artwork: 'blank',
      documents: 1,
    };
    setProjects((previous) => [project, ...previous]);
    setSurface('projects');
    setSelected(project);
    setView('projects');
    setQuery('');
    setFilter('active');
    setDraft({
      name: '',
      goal: '',
      brief: '',
      personaId: 'paper-type',
      size: '1080 × 1440',
      mode: 'manual',
    });
    notify(
      t(
        locale,
        '预览草稿已创建，关闭预览后不会保留。',
        'Preview draft created. It will not be kept after leaving this preview.',
      ),
    );
  };
  const projectName = (project: Project) =>
    t(locale, project.name, project.enName);
  const designerName = (name: string) =>
    locale === 'zh-CN'
      ? name
      : ((
          {
            纸感排版: 'Paper & type',
            极简构成: 'Minimal form',
            自然叙事: 'Natural stories',
            清晰商业: 'Clear Commerce',
          } as Record<string, string>
        )[name] ?? name);
  const projectPersonaId = (project: Project) => {
    const name = project.designers[0];
    return (
      {
        纸感排版: 'paper-type',
        极简构成: 'paper-type',
        自然叙事: 'natural-story',
        清晰商业: 'clear-commerce',
      } as Record<string, string>
    )[name] ?? 'paper-type';
  };
  const openDelivery = (project: Project) => {
    setDeliveryProject(project);
    navigate('delivery');
  };
  const openNewDesign = (mode: NewDesignDraft['mode'], personaId?: string) => {
    setDraft((previous) => ({
      ...previous,
      mode,
      personaId: personaId ?? previous.personaId,
    }));
    setSurface('new-design');
    setView('projects');
    setSelected(null);
    setDocumentOpen(false);
  };
  return (
    <>
      <WindowBar
        copy={getMessages(locale)}
        locale={locale}
        theme={theme}
        nativeControlSide={nativeControlSide}
        onLocaleChange={onLocaleChange}
        onThemeChange={onThemeChange}
        previewLabel={t(locale, '示例预览', 'Example preview')}
        themeLabel={t(locale, '切换主题', 'Switch theme')}
        workspace={{
          name: t(locale, '我的设计空间', 'My design studio'),
          detail: t(locale, '示例工作区', 'Example workspace'),
          label: t(locale, '切换工作区', 'Switch workspace'),
          onClick: () => setDialog('workspace'),
        }}
      />
      <div className={`studio ${collapsed ? 'studio--compact' : ''}`}>
        <aside className="studio-sidebar">
        <nav
          aria-label={t(locale, '主导航', 'Main navigation')}
          className="main-navigation"
        >
          {navigation.map((item, index) => (
            <div key={item.view}>
              {(index === 4 || index === 7) && <div className="nav-divider" />}
              <button
                onClick={() => navigate(item.view)}
                aria-current={view === item.view ? 'page' : undefined}
                aria-label={t(locale, item.zh, item.en)}
                title={t(locale, item.zh, item.en)}
                className={`nav-item ${view === item.view ? 'is-active' : ''}`}
              >
                <Icon name={item.icon} />
                <span className="sidebar-label">
                  {t(locale, item.zh, item.en)}
                </span>
                {item.view === 'projects' && (
                  <span className="nav-count sidebar-label">
                    {projects.length}
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <Icon name="hard-drive" size={16} />
            <span className="sidebar-label">
              {t(locale, '创作由你掌握', 'Your work, your space')}
              <small>
                {t(
                  locale,
                  '本地优先 · 无需账号',
                  'Local first · No account needed',
                )}
              </small>
            </span>
          </div>
          <button
            className="operator"
            onClick={() => navigate('settings')}
            title={t(locale, '本机操作者设置', 'Local operator settings')}
          >
            <span className="operator-avatar">S</span>
            <span className="sidebar-label">
              {t(locale, '本机操作者', 'Local operator')}
              <small>
                {t(locale, '仅用于创作署名', 'For creative attribution')}
              </small>
            </span>
            <Icon name="settings" size={15} />
          </button>
        </div>
        </aside>
        <div className="studio-main">
        <header className="studio-toolbar">
          <div className="toolbar-location">
            <IconButton
              name="panel-left"
              label={t(locale, '切换侧栏', 'Toggle sidebar')}
              onClick={() => setCollapsed(!collapsed)}
            />
            <span className="toolbar-divider" />
            <span className="toolbar-workspace">
              {t(locale, '我的设计空间', 'My design studio')}
            </span>
            <Icon name="chevron-right" size={14} />
            <span className="breadcrumb-current">
              {selected ? projectName(selected) : t(locale, title.zh, title.en)}
            </span>
          </div>
        </header>
        <div className="studio-body">
          {surface === 'new-design' && (
            <NewDesignPage
              locale={locale}
              draft={draft}
              onDraftChange={setDraft}
              onCreate={createProject}
              onBack={() => setSurface('projects')}
            />
          )}
          {surface === 'projects' && view === 'projects' && !selected && (
            <section className="page-content projects-page">
              <PageHeader
                title={t(locale, '项目库', 'Projects')}
                description={t(
                  locale,
                  '从一个想法，到一组完整的作品。',
                  'From the first idea to a complete collection.',
                )}
                eyebrow={t(locale, '工作区 / 创作', 'WORKSPACE / CREATE')}
              >
                <Button
                  icon="message-square"
                  variant="ai"
                  onClick={() => openNewDesign('conversation')}
                >
                  {t(locale, '对话创建', 'Create with chat')}
                </Button>
                <Button
                  icon="plus"
                  variant="primary"
                  onClick={() => openNewDesign('manual')}
                >
                  {t(locale, '新建项目', 'New project')}
                </Button>
              </PageHeader>
              <div className="project-controls">
                <div
                  className="tab-strip"
                  aria-label={t(locale, '项目状态', 'Project status')}
                >
                  {(['active', 'archived', 'all'] as const).map((value) => (
                    <button
                      key={value}
                      className={filter === value ? 'is-active' : ''}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {value === 'active'
                        ? t(locale, '进行中', 'Active')
                        : value === 'archived'
                          ? t(locale, '已归档', 'Archived')
                          : t(locale, '全部项目', 'All projects')}
                      {value === 'active' && (
                        <span>
                          {
                            projects.filter((project) => !project.archived)
                              .length
                          }
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="project-search-tools">
                  <label className="search-input">
                    <Icon name="search" size={16} />
                    <input
                      type="search"
                      aria-label={t(locale, '搜索项目', 'Search projects')}
                      placeholder={t(locale, '搜索项目…', 'Search projects…')}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <div className="view-toggle">
                    <IconButton
                      name="layout-grid"
                      label={t(locale, '网格视图', 'Grid view')}
                      aria-pressed={display === 'grid'}
                      onClick={() => setDisplay('grid')}
                    />
                    <IconButton
                      name="list"
                      label={t(locale, '列表视图', 'List view')}
                      aria-pressed={display === 'list'}
                      onClick={() => setDisplay('list')}
                    />
                  </div>
                </div>
              </div>
              {visibleProjects.length ? (
                <div
                  className={`project-collection project-collection--${display}`}
                >
                  {visibleProjects.map((project) => (
                    <button
                      className="project-card"
                      key={project.id}
                      onClick={() => openProject(project)}
                      aria-label={projectName(project)}
                    >
                      <div className="project-cover">
                        <ArtworkPreview kind={project.artwork} />
                        <span className="project-open">
                          <Icon name="arrow-up-right" size={20} />
                        </span>
                        <span className="cover-caption">
                          {project.documents} {t(locale, '份文档', 'documents')}
                        </span>
                      </div>
                      <div className="project-card-body">
                        <div className="project-title-line">
                          <h2>{projectName(project)}</h2>
                          <Icon name="arrow-up-right" size={16} />
                        </div>
                        <p>
                          {t(
                            locale,
                            project.description,
                            project.enDescription,
                          )}
                        </p>
                        <div className="project-meta">
                          <span className="design-attribution">
                            <PersonaArtwork personaId={projectPersonaId(project)} crop="avatar" />
                            <strong>
                              {designerName(project.designers[0] ?? '纸感排版')} · {getPersona(projectPersonaId(project))?.version ?? 'v1.0'}
                            </strong>
                          </span>
                          <span className="project-meta-end">
                            {t(locale, '示例', 'Example')}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="search"
                  title={t(locale, '没有匹配的项目', 'No matching projects')}
                  description={t(
                    locale,
                    '试试其他关键词，或查看全部项目。',
                    'Try another keyword or view all projects.',
                  )}
                >
                  <Button
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    {t(locale, '清除搜索', 'Clear search')}
                  </Button>
                </EmptyState>
              )}
              <div className="creation-note">
                <span className="creation-note-symbol">
                  <Icon name="sparkles" size={22} />
                </span>
                <div>
                  <h2>
                    {t(
                      locale,
                      '下一次创作，从这里开始',
                      'Start your next creative direction',
                    )}
                  </h2>
                  <p>
                    {t(
                      locale,
                      '选择设计师、整理简报，或直接打开空白文档。',
                      'Choose a designer, write a brief, or start with a blank document.',
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  icon="arrow-right"
                  onClick={() => openNewDesign('manual')}
                >
                  {t(locale, '开始创作', 'Start creating')}
                </Button>
              </div>
              <p className="example-footnote">
                <Icon name="circle-help" size={14} />
                {t(
                  locale,
                  '这些示例用于浏览界面。预览中的修改仅在本次会话保留。',
                  'Explore with example content. Preview changes last for this session only.',
                )}
              </p>
            </section>
          )}
          {surface === 'projects' && view === 'projects' && selected && !documentOpen && (
            <section className="page-content project-detail">
              <Button
                icon="arrow-left"
                variant="ghost"
                onClick={() => setSelected(null)}
              >
                {t(locale, '返回列表', 'Back to projects')}
              </Button>
              <PageHeader
                title={projectName(selected)}
                description={t(
                  locale,
                  selected.description,
                  selected.enDescription,
                )}
                eyebrow={t(
                  locale,
                  '设计项目 / 示例',
                  'DESIGN PROJECT / EXAMPLE',
                )}
              >
                <Button icon="download" onClick={() => openDelivery(selected)}>
                  {t(locale, '导出交付', 'Delivery')}
                </Button>
                <Button
                  variant="primary"
                  icon="file-image"
                  onClick={() => setDocumentOpen(true)}
                >
                  {t(locale, '继续编辑', 'Open workbench')}
                </Button>
              </PageHeader>
              <DesignerHero
                personaId={projectPersonaId(selected)}
                locale={locale}
                label={t(locale, '当前设计师', 'Active designer')}
              />
              <div className="project-context">
                <div>
                  <small>{t(locale, '活跃版本', 'ACTIVE VERSION')}</small>
                  <strong>{getPersona(projectPersonaId(selected))?.version ?? 'v1.0'}</strong>
                </div>
                <div>
                  <small>{t(locale, '项目状态', 'PROJECT STATUS')}</small>
                  <strong>{t(locale, '预览草稿', 'Preview draft')}</strong>
                </div>
                <div>
                  <small>{t(locale, '品牌上下文', 'BRAND CONTEXT')}</small>
                  <strong>
                    {t(locale, '未附加品牌包', 'No brand kit attached')}
                  </strong>
                </div>
                <div>
                  <small>{t(locale, '内容保留', 'RETENTION')}</small>
                  <strong>
                    {t(locale, '仅本次预览', 'This preview only')}
                  </strong>
                </div>
              </div>
              <div className="section-title">
                <h2>{t(locale, '设计文档', 'Design documents')}</h2>
                <span>
                  {selected.documents} {t(locale, '份物料', 'deliverables')}
                </span>
              </div>
              <div className="document-collection">
                {Array.from({ length: selected.documents }, (_, index) => (
                  <button
                    className="document-card"
                    key={index}
                    onClick={() => {
                      if (index === 0) setDocumentOpen(true);
                      else
                        notify(
                          t(
                            locale,
                            '当前可打开主海报预览，其他尺寸稿将在文档能力接入后提供。',
                            'Open the main poster preview. Other sizes will be available with document storage.',
                          ),
                        );
                    }}
                    aria-label={
                      index === 0
                        ? t(locale, '打开主海报', 'Open main poster')
                        : t(
                            locale,
                            `查看尺寸稿 ${index}`,
                            `View size variant ${index}`,
                          )
                    }
                  >
                    <div
                      className={`document-cover document-cover--${index % 3}`}
                    >
                      <ArtworkPreview kind={selected.artwork} />
                    </div>
                    <div className="document-card-body">
                      <h3>
                        {index === 0
                          ? t(locale, '主海报', 'Main poster')
                          : index === 1
                            ? t(locale, '社媒方图', 'Social square')
                            : t(locale, '活动横幅', 'Campaign banner')}
                      </h3>
                      <span>
                        {index === 0
                          ? '1080 × 1440'
                          : index === 1
                            ? '1080 × 1080'
                            : '1920 × 1080'}{' '}
                        px <Badge>{t(locale, '示例', 'Example')}</Badge>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="brief-summary">
                <h2>{t(locale, '设计简报', 'Design brief')}</h2>
                <p>{t(locale, selected.description, selected.enDescription)}</p>
                <p className="muted">
                  {t(
                    locale,
                    '参考素材、固定文案和设计约束会随正式项目一同保留。',
                    'Reference assets, fixed copy and creative constraints will be retained with a real project.',
                  )}
                </p>
              </div>
            </section>
          )}
          {projects.map((project) => (
            <div
              className="destination"
              key={project.id}
                hidden={
                  surface !== 'projects' ||
                  view !== 'projects' ||
                !documentOpen ||
                selected?.id !== project.id
              }
            >
              <Workbench
                locale={locale}
                project={project}
                onBack={() => setDocumentOpen(false)}
                onExport={() => openDelivery(project)}
                onConnections={() => navigate('connections')}
                notify={notify}
              />
            </div>
          ))}
          {navigation
            .filter((item) => item.view !== 'projects')
            .map((item) => (
              <div
                className="destination"
                key={item.view}
                hidden={surface !== item.view || view !== item.view}
              >
                <LibraryPages
                  locale={locale}
                  view={item.view as Exclude<View, 'projects'>}
                  deliveryProject={deliveryProject}
                  notify={notify}
                  navigate={navigate}
                  onUseForNew={(personaId) => openNewDesign('manual', personaId)}
                  theme={theme}
                  onThemeChange={onThemeChange}
                  onLocaleChange={onLocaleChange}
                />
              </div>
            ))}
        </div>
        <footer className="studio-status">
          <span>
            <Icon name="hard-drive" size={12} />
            {t(
              locale,
              '示例工作区 · 仅本次预览',
              'Example workspace · Session only',
            )}
          </span>
          <span>
            <Icon name="plug" size={12} />
            {t(locale, '模型未连接', 'No model connected')}
          </span>
          <span className="status-end">
            DesignHub <span className="mono">0.1</span>
          </span>
        </footer>
        </div>
      </div>
      {notice && (
        <div role="status" className="studio-toast">
          <Icon name="circle-help" size={18} />
          <span>{notice}</span>
          <IconButton
            name="x"
            label={t(locale, '关闭提示', 'Dismiss notification')}
            onClick={() => setNotice('')}
          />
        </div>
      )}
      {dialog === 'workspace' && (
        <Modal
          title={t(locale, '切换工作区', 'Switch workspace')}
          onClose={() => setDialog(null)}
          locale={locale}
        >
          <p className="muted">
            {t(
              locale,
              '示例修改仅在本次预览中保留，离开示例后会清除。',
              'Example edits stay in this preview and are cleared when you leave it.',
            )}
          </p>
          <button className="workspace-choice" onClick={() => setDialog(null)}>
            <span className="workspace-monogram">D</span>
            <span>
              <strong>{t(locale, '我的设计空间', 'My design studio')}</strong>
              <small>
                {t(locale, '示例工作区 · 当前', 'Example workspace · Current')}
              </small>
            </span>
            <Icon name="check" />
          </button>
          <div className="dialog-actions">
            <Button onClick={onExit} icon="folder-open">
              {t(locale, '工作区', 'Workspace welcome')}
            </Button>
            <Button onClick={() => setDialog(null)} variant="primary">
              {t(locale, '继续浏览', 'Continue browsing')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};

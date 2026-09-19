import type { Locale } from '../i18n';
import { isBrand } from '../../features/brands/constraints';
import { PersonaArtwork } from './PersonaArtwork';
import { ProjectCoverImage } from './ProjectCoverImage';
import { localize, type PersonaProfile } from './personas';
import type { Project } from './types';
import { ArtworkPreview, Badge, Button, EmptyState, Field, Icon, Select, t } from './ui';
import './project-detail.css';

export type ProjectDetailPageProps = {
  locale: Locale;
  project: Project;
  profiles: PersonaProfile[];
  writable: boolean;
  projectTitle: string;
  activeDesignerId: string;
  designerLabel: string;
  contributorIds: string[];
  contributorLabel: string;
  onOpenDocument: (documentId: string | undefined, index: number) => void;
  onExport: () => void;
  onCreateDocument: () => void;
  onSwitchDesigner: (designerId: string) => void;
  onToggleContributor: (designerId: string) => void;
};

type DocumentEntry = NonNullable<Project['documentEntries']>[number];

const documentStatus = (locale: Locale, entry: DocumentEntry | undefined): string => {
  if (!entry) return t(locale, '未保存', 'Unsaved');
  if (entry.finalizedRevisionId) return t(locale, '已定稿', 'Final');
  if (entry.sourceRevisionId) return t(locale, '衍生稿', 'Derived');
  return t(locale, '进行中', 'In progress');
};

const documentDimensions = (entry: DocumentEntry | undefined): string => (
  entry ? `${entry.width} × ${entry.height} px` : '1080 × 1440 px'
);

const documentName = (locale: Locale, entry: DocumentEntry | undefined, index: number): string => {
  if (!entry) return t(locale, index === 0 ? '主海报' : `尺寸稿 ${index + 1}`, index === 0 ? 'Main poster' : `Size variant ${index + 1}`);
  if (entry.name === '主海报') return t(locale, '主海报', 'Main poster');
  return entry.name;
};

const documentOpenLabel = (locale: Locale, name: string, entry: DocumentEntry | undefined): string => (
  locale === 'en' && entry?.name === '主海报' ? 'Open main poster' : t(locale, `打开${name}`, `Open ${name}`)
);

export const ProjectDetailPage = ({
  locale,
  project,
  profiles,
  writable,
  projectTitle,
  activeDesignerId,
  designerLabel,
  contributorIds,
  contributorLabel,
  onOpenDocument,
  onExport,
  onCreateDocument,
  onSwitchDesigner,
  onToggleContributor,
}: ProjectDetailPageProps) => {
  const documents = project.documentEntries ?? Array.from<DocumentEntry | undefined>({ length: project.documents });
  const firstDocumentId = project.documentEntries?.[0]?.id ?? project.documentId;
  const hasDocuments = documents.length > 0;
  const activeProfiles = profiles.filter((profile) => profile.status !== 'archived');
  const brand = isBrand(project.brandSnapshot) ? project.brandSnapshot : null;
  const designerVersion = (project.designerSnapshot as { version?: string } | undefined)?.version;
  const brief = t(locale, project.description, project.enDescription).trim();
  const saved = Boolean(project.workspaceId);
  const hasDesigner = Boolean(activeDesignerId && designerLabel.trim());
  const displayDesignerLabel = hasDesigner
    ? designerLabel.trim()
    : t(locale, '未设置设计师', 'No designer selected');
  const projectStatus = project.archived
    ? t(locale, '已归档', 'Archived')
    : saved
      ? t(locale, '进行中', 'Active')
      : t(locale, '未保存草稿', 'Unsaved draft');

  const openPrimaryDocument = (): void => onOpenDocument(firstDocumentId, 0);

  return (
    <section className="page-content project-detail-page" data-testid="project-detail-page">
      <section className="project-detail-header" data-testid="project-detail-header">
        <div className="project-detail-hero" data-testid="project-detail-hero">
          <ProjectCoverImage
            workspaceId={project.workspaceId}
            projectId={project.id}
            coverAssetId={project.coverAssetId}
            previewUrl={project.coverPreviewUrl}
            alt={t(locale, `${projectTitle}项目封面`, `${projectTitle} project cover`)}
          />
          <div className="project-detail-hero__overlay">
            <span className="project-detail-hero__eyebrow">
              <Icon name="layers" size={15} />
              {project.documents} {t(locale, '份文档', 'documents')}
            </span>
          </div>
        </div>

        <header className="project-detail-summary">
          <div className="project-detail-summary__content">
            <div className="project-detail-summary__status">
              <span className="project-detail-status-dot" aria-hidden="true" />
              {projectStatus}
            </div>
            <h1>{projectTitle}</h1>
            <p className={`project-detail-summary__description ${brief ? '' : 'is-empty'}`}>
              {brief || t(locale, '暂无项目简介', 'No project brief yet')}
            </p>
            <div className="project-detail-summary__meta">
              <span className="project-detail-attribution" aria-label={t(locale, '版本署名', 'Revision credits')}>
                <span className="project-detail-attribution__avatars" aria-hidden="true">
                  {contributorIds.slice(0, 3).map((designerId) => (
                    <PersonaArtwork
                      key={designerId}
                      locale={locale}
                      personaId={designerId}
                      profile={profiles.find((profile) => profile.id === designerId)}
                      crop="avatar"
                    />
                  ))}
                </span>
                <span>
                  <small>{t(locale, '设计署名', 'Design credit')}</small>
                  <strong>{displayDesignerLabel}{hasDesigner && designerVersion ? ` · ${designerVersion}` : ''}</strong>
                  {contributorLabel && contributorLabel !== designerLabel && (
                    <span className="project-detail-attribution__contributors">{contributorLabel}</span>
                  )}
                </span>
              </span>
              <span className="project-detail-storage">
                <Icon name={saved ? 'hard-drive' : 'clock'} size={15} />
                {saved ? t(locale, '本地保存', 'Saved locally') : t(locale, '仅当前会话', 'This session only')}
              </span>
            </div>
          </div>
          <div className="project-detail-summary__actions">
            {hasDocuments && (
              <Button icon="arrow-up-right" variant="primary" onClick={openPrimaryDocument}>
                {t(locale, '打开画布', 'Open canvas')}
              </Button>
            )}
            <Button icon="download" onClick={onExport}>
              {t(locale, '导出交付', 'Export')}
            </Button>
          </div>
        </header>
      </section>

      <div className="project-detail-layout" data-testid="project-detail-layout">
        <section className="project-detail-documents" aria-label={t(locale, '设计文档', 'Design documents')}>
          <div className="project-detail-section-heading">
            <div>
              <span className="project-detail-section-heading__index">01</span>
              <h2>{t(locale, '设计文档', 'Design documents')}</h2>
              <p>{project.documents} {t(locale, '份物料', 'deliverables')}</p>
            </div>
            {writable && (
              <Button icon="plus" onClick={onCreateDocument}>
                {t(locale, '新建尺寸', 'New size')}
              </Button>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="project-detail-empty">
              <EmptyState
                icon="file-image"
                title={t(locale, '暂无设计文档', 'No design documents yet')}
                description={t(locale, '创建文档后会显示在这里。', 'Create a document to see it here.')}
              />
            </div>
          ) : (
            <div className="project-detail-document-grid">
              {documents.map((entry, index) => {
                const name = documentName(locale, entry, index);
                return (
                  <button
                    type="button"
                    className="project-detail-document-card"
                    key={entry?.id ?? index}
                    aria-label={documentOpenLabel(locale, name, entry)}
                    onClick={() => onOpenDocument(entry?.id, index)}
                  >
                    <span className={`project-detail-document-card__preview document-cover document-cover--${index % 3}`}>
                      <ArtworkPreview kind={project.artwork} />
                    </span>
                    <span className="project-detail-document-card__body">
                      <span>
                        <span className="project-detail-document-card__title">
                          <h3>{name}</h3>
                          <Icon name="arrow-up-right" size={15} />
                        </span>
                        <span className="project-detail-document-card__dimensions">{documentDimensions(entry)}</span>
                      </span>
                      <span className="project-detail-document-card__meta">
                        <Badge>{saved ? t(locale, '本地', 'Local') : t(locale, '未保存', 'Unsaved')}</Badge>
                        <span>{documentStatus(locale, entry)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="project-detail-sidebar" aria-label={t(locale, '项目信息', 'Project information')}>
          <section className="project-detail-panel">
            <div className="project-detail-panel__header">
              <span className="project-detail-panel__icon"><Icon name="info" size={16} /></span>
              <div>
                <span className="project-detail-panel__index">02</span>
                <h2>{t(locale, '项目上下文', 'Project context')}</h2>
              </div>
            </div>
            <div className="project-detail-context-grid">
              <div>
                <small>{t(locale, '活跃版本', 'ACTIVE VERSION')}</small>
                <strong>{designerVersion ?? t(locale, '未设置', 'Not set')}</strong>
              </div>
              <div>
                <small>{t(locale, '项目状态', 'PROJECT STATUS')}</small>
                <strong>{projectStatus}</strong>
              </div>
              <div>
                <small>{t(locale, '文档数量', 'DOCUMENTS')}</small>
                <strong>{project.documents}</strong>
              </div>
              <div>
                <small>{t(locale, '内容保留', 'RETENTION')}</small>
                <strong>{saved ? t(locale, '本地保存', 'Saved locally') : t(locale, '仅当前会话', 'This session only')}</strong>
              </div>
            </div>
          </section>

          <section className="project-detail-panel project-detail-collaboration">
            <div className="project-detail-panel__header">
              <span className="project-detail-panel__icon"><Icon name="users" size={16} /></span>
              <div>
                <span className="project-detail-panel__index">03</span>
                <h2>{t(locale, '设计协作', 'Design collaboration')}</h2>
              </div>
            </div>
            <div className="project-detail-lead">
              {activeDesignerId ? (
                <PersonaArtwork
                  locale={locale}
                  personaId={activeDesignerId}
                  profile={profiles.find((profile) => profile.id === activeDesignerId)}
                  crop="avatar"
                />
              ) : (
                <span className="project-detail-lead__empty"><Icon name="user" size={18} /></span>
              )}
              <span>
                <small>{t(locale, '当前设计师', 'Active designer')}</small>
                <strong>{designerLabel}</strong>
                {contributorLabel && <span>{contributorLabel}</span>}
              </span>
            </div>

            {writable && (
              <div className="project-detail-collaboration__controls">
                <Field label={t(locale, '设计师', 'Designer')}>
                  <Select
                    ariaLabel={t(locale, '设计师', 'Designer')}
                    value={activeDesignerId}
                    onChange={onSwitchDesigner}
                    options={activeProfiles.map((profile) => ({
                      value: profile.id,
                      label: `${localize(locale, profile.name)} · ${profile.version}`,
                    }))}
                  />
                </Field>
                <fieldset className="project-detail-contributors">
                  <legend>{t(locale, '版本署名', 'Revision credits')}</legend>
                  <p>{t(locale, '当前设计师始终作为主署名。', 'The active designer remains the lead credit.')}</p>
                  <div className="project-detail-contributors__list">
                    {activeProfiles.map((profile) => (
                      <label key={profile.id}>
                        <input
                          type="checkbox"
                          checked={contributorIds.includes(profile.id)}
                          disabled={profile.id === activeDesignerId}
                          onChange={() => onToggleContributor(profile.id)}
                        />
                        <span>{localize(locale, profile.name)} · {profile.version}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          </section>

          <section className="project-detail-panel project-detail-brand">
            <div className="project-detail-panel__header">
              <span className="project-detail-panel__icon"><Icon name="palette" size={16} /></span>
              <div>
                <span className="project-detail-panel__index">04</span>
                <h2>{t(locale, '品牌快照', 'Brand snapshot')}</h2>
              </div>
            </div>
            {brand ? (
              <div className="project-detail-brand__content">
                <div className="project-detail-brand__title">
                  <strong>{brand.name?.trim() || brand.id}</strong>
                  <Badge>{brand.version}</Badge>
                </div>
                <div className="project-detail-brand-row">
                  <small>{t(locale, '色板', 'COLORS')}</small>
                  <div className="project-detail-brand-colors">
                    {brand.colorPalette.map((color, index) => (
                      <span
                        className="project-detail-brand-swatch"
                        key={`${color}-${index}`}
                        style={{ backgroundColor: color }}
                        title={color}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </div>
                <div className="project-detail-brand-row">
                  <small>{t(locale, '字体', 'FONTS')}</small>
                  <strong>{brand.fonts.join(' · ') || t(locale, '未设置', 'Not set')}</strong>
                </div>
                <div className="project-detail-brand-row">
                  <small>{t(locale, '语气', 'TONE')}</small>
                  <strong>{brand.tone || t(locale, '未设置', 'Not set')}</strong>
                </div>
              </div>
            ) : (
              <p className="project-detail-panel__empty">
                {t(locale, '未附加品牌包', 'No brand kit attached')}
              </p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
};

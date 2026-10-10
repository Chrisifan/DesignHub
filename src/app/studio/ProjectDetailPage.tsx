import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import { ProjectCoverImage } from './ProjectCoverImage';
import { ProjectDocumentPreview } from './ProjectDocumentPreview';
import type { PersonaProfile } from './personas';
import type { Project } from './types';
import { EmptyState, Icon, t } from './ui';
import './project-detail.css';

export type ProjectDetailPageProps = {
  locale: Locale;
  project: Project;
  profiles: PersonaProfile[];
  projectTitle: string;
  activeDesignerId: string;
  designerLabel: string;
  contributorIds: string[];
  contributorLabel: string;
  onOpenDocument: (documentId: string | undefined, index: number) => void;
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

const documentCoverStyle = (entry: DocumentEntry | undefined): { aspectRatio: string; width: string } => {
  const width = entry?.width && entry.width > 0 ? entry.width : 1080;
  const height = entry?.height && entry.height > 0 ? entry.height : 1440;
  const previewWidth = Math.min(96, 128 * (width / height));
  return { aspectRatio: `${width} / ${height}`, width: `${previewWidth}px` };
};

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
  projectTitle,
  activeDesignerId,
  designerLabel,
  contributorIds,
  contributorLabel,
  onOpenDocument,
}: ProjectDetailPageProps) => {
  const documents = project.documentEntries ?? Array.from<DocumentEntry | undefined>({ length: project.documents });
  const designerVersion = (project.designerSnapshot as { version?: string } | undefined)?.version;
  const brief = t(locale, project.description, project.enDescription).trim();
  const saved = Boolean(project.libraryId);
  const hasDesigner = Boolean(activeDesignerId && designerLabel.trim());
  const displayDesignerLabel = hasDesigner
    ? designerLabel.trim()
    : t(locale, '未设置设计师', 'No designer selected');
  const projectStatus = project.archived
    ? t(locale, '已归档', 'Archived')
    : saved
      ? t(locale, '进行中', 'Active')
      : t(locale, '未保存草稿', 'Unsaved draft');
  const projectStatusTone = project.archived ? 'neutral' : saved ? 'success' : 'warning';

  return (
    <section className="page-content project-detail-page" data-testid="project-detail-page">
      <section className="project-detail-header" data-testid="project-detail-header">
        <div className="project-detail-hero" data-testid="project-detail-hero">
          <ProjectCoverImage
            libraryId={project.libraryId}
            projectId={project.id}
            coverAssetId={project.coverAssetId}
            previewUrl={project.coverPreviewUrl}
            alt={t(locale, `${projectTitle}项目封面`, `${projectTitle} project cover`)}
          />
          <div className="project-detail-hero__overlay">
            <span
              className="project-detail-hero__status"
              aria-label={t(locale, '项目状态与设计稿数量', 'Project status and design count')}
            >
              <span className={`project-detail-status-dot project-detail-status-dot--${projectStatusTone}`} aria-hidden="true" />
              <span>{projectStatus}</span>
              <span className="project-detail-hero__status-separator" aria-hidden="true">·</span>
              <Icon name="layers" size={15} />
              <span>{documents.length} {t(locale, '份设计稿', 'designs')}</span>
            </span>
          </div>
        </div>

        <header className="project-detail-summary">
          <div className="project-detail-summary__content">
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
            </div>
          </div>
        </header>
      </section>

      <div className="project-detail-layout project-detail-layout--documents-only" data-testid="project-detail-layout">
        <section className="project-detail-documents project-detail-documents--full" aria-label={t(locale, '项目图片', 'Project images')}>
          <div className="project-detail-section-heading">
            <div>
              <span className="project-detail-section-heading__index">01</span>
              <h2>{t(locale, '项目图片', 'Project images')}</h2>
              <p>{documents.length} {t(locale, '张图片', 'images')}</p>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="project-detail-empty">
              <EmptyState
                icon="file-image"
                title={t(locale, '暂无项目图片', 'No project images yet')}
                description={t(locale, '导入图片后会显示在这里。', 'Add an image to see it here.')}
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
                    <span className="project-detail-document-card__preview document-cover">
                      <span className="project-detail-document-card__sheet" style={documentCoverStyle(entry)}>
                        <ProjectDocumentPreview
                          libraryId={project.libraryId}
                          projectId={project.id}
                          documentId={entry?.id}
                          artwork={project.artwork}
                          alt={t(locale, `${name}定稿预览`, `${name} final preview`)}
                        />
                      </span>
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
                        <span>{documentStatus(locale, entry)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </section>
  );
};

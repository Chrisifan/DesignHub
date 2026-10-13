import type { Locale } from '../i18n';
import { ProjectCoverImage } from './ProjectCoverImage';
import type { Project } from './types';
import { Icon, t } from './ui';

type ProjectFilter = 'active' | 'archived' | 'all';

type HomeProjectPanelProps = {
  locale: Locale;
  allProjects: Project[];
  projects: Project[];
  filter: ProjectFilter;
  transitionDirection?: 'forward' | 'backward' | null;
  query: string;
  loadFailed: boolean;
  onFilterChange: (value: ProjectFilter) => void;
  onQueryChange: (value: string) => void;
  onOpenProject: (project: Project) => void;
  onRetry: () => void;
};

const filters: Array<{ value: ProjectFilter; zh: string; en: string }> = [
  { value: 'active', zh: '进行中', en: 'Active' },
  { value: 'archived', zh: '已归档', en: 'Archived' },
  { value: 'all', zh: '全部项目', en: 'All projects' },
];

export const HomeProjectPanel = ({
  locale,
  allProjects,
  projects,
  filter,
  transitionDirection,
  query,
  loadFailed,
  onFilterChange,
  onQueryChange,
  onOpenProject,
  onRetry,
}: HomeProjectPanelProps) => {
  const projectName = (project: Project): string => locale === 'zh-CN' ? project.name : project.enName;
  const activeCount = allProjects.filter((project) => !project.archived).length;
  const formatDate = (value: string): string => new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

  return (
    <aside className="studio-home-projects" aria-label={t(locale, '项目列表', 'Projects')}>
      <div className="studio-home-projects__heading">
        <div>
          <p>{t(locale, '工作区项目', 'Workspace projects')}</p>
          <h2>{t(locale, '创作中心', 'Creative library')}</h2>
        </div>
        <span>{activeCount}</span>
      </div>
      <div className="studio-home-projects__filters" role="group" aria-label={t(locale, '项目状态', 'Project status')}>
        {filters.map((entry) => (
          <button
            type="button"
            key={entry.value}
            className={filter === entry.value ? 'is-active' : ''}
            aria-pressed={filter === entry.value}
            onClick={() => onFilterChange(entry.value)}
          >
            {t(locale, entry.zh, entry.en)}
          </button>
        ))}
      </div>
      <label className="studio-home-projects__search">
        <Icon name="search" size={15} />
        <input
          type="search"
          aria-label={t(locale, '搜索项目', 'Search projects')}
          value={query}
          placeholder={t(locale, '搜索名称或设计师', 'Search name or designer')}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <div
        key={filter}
        className={`studio-home-projects__list${transitionDirection ? ` studio-project-list-enter-${transitionDirection}` : ''}`}
      >
        {loadFailed ? (
          <div className="studio-home-projects__empty">
            <Icon name="circle-alert" size={22} />
            <p>{t(locale, '项目加载失败。', 'Projects could not be loaded.')}</p>
            <button type="button" onClick={onRetry}>{t(locale, '重试', 'Retry')}</button>
          </div>
        ) : projects.length === 0 ? (
          <div className="studio-home-projects__empty">
            <Icon name="folder-open" size={22} />
            <p>{query ? t(locale, '没有匹配的项目。', 'No matching projects.') : t(locale, '尚无项目，从右侧开始创作。', 'No projects yet. Start on the right.')}</p>
            {query ? (
              <button type="button" onClick={() => onQueryChange('')}>
                {t(locale, '清除搜索', 'Clear search')}
              </button>
            ) : null}
          </div>
        ) : projects.map((project) => (
          <button
            type="button"
            className="studio-home-project-row"
            aria-label={projectName(project)}
            key={project.id}
            onClick={() => onOpenProject(project)}
          >
            <span className="studio-home-project-row__cover">
              <ProjectCoverImage
                libraryId={project.libraryId}
                projectId={project.id}
                coverAssetId={project.designs?.[0]?.assetId}
                alt=""
              />
            </span>
            <span className="studio-home-project-row__copy">
              <strong>{projectName(project)}</strong>
              <small>
                {t(locale, `${project.designs?.length ?? 0} 份设计稿`, `${project.designs?.length ?? 0} design${project.designs?.length === 1 ? '' : 's'}`)}
                {project.updatedAt ? <span>· {formatDate(project.updatedAt)}</span> : null}
              </small>
            </span>
            <Icon name="chevron-right" size={15} />
          </button>
        ))}
      </div>
    </aside>
  );
};

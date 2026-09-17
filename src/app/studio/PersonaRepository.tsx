import { useMemo, useState } from 'react';

import type { Locale } from '../i18n';
import { DesignerProfileCard } from './DesignerProfileCard';
import { PageToolbarSlot } from './PageToolbar';
import { localize, type PersonaProfile } from './personas';
import { EmptyState, Icon, t } from './ui';

/** User-facing filters intentionally omit the legacy status value. */
export type PersonaStatusFilter = 'all' | Exclude<PersonaProfile['status'], 'built-in'>;

type PersonaRepositoryProps = {
  locale: Locale;
  profiles: PersonaProfile[];
  selectedId: string;
  query?: string;
  statusFilter?: PersonaStatusFilter;
  defaultId?: string;
  sessionDefaultId?: string;
  onQueryChange?: (value: string) => void;
  onStatusFilterChange?: (value: PersonaStatusFilter) => void;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  toolbarActive?: boolean;
};

const statusLabel = (locale: Locale, status: PersonaProfile['status']): string =>
  status === 'published' || status === 'built-in'
    ? t(locale, '已发布', 'Published')
    : status === 'archived'
        ? t(locale, '已归档', 'Archived')
      : t(locale, '草稿', 'Draft');

export const PersonaRepository = ({
  locale,
  profiles,
  selectedId,
  query: queryProp,
  statusFilter: statusFilterProp,
  defaultId,
  sessionDefaultId,
  onQueryChange,
  onStatusFilterChange,
  onSelect,
  onCreate,
  toolbarActive = true,
}: PersonaRepositoryProps) => {
  const [localQuery, setLocalQuery] = useState('');
  const [localStatusFilter, setLocalStatusFilter] = useState<PersonaStatusFilter>('all');
  const query = queryProp ?? localQuery;
  const statusFilter = statusFilterProp ?? localStatusFilter;
  const activeDefaultId = sessionDefaultId ?? defaultId;
  const filteredProfiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return profiles.filter((profile) => {
      const matchesStatus =
        statusFilter === 'all'
        || profile.status === statusFilter;
      const searchText = [
        localize(locale, profile.name),
        localize(locale, profile.signature),
        profile.personaCode,
        ...profile.tags.map((tag) => localize(locale, tag)),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return matchesStatus && (!normalized || searchText.includes(normalized));
    });
  }, [locale, profiles, query, statusFilter]);

  return (
    <div className="persona-repository" aria-label={t(locale, '设计师档案库', 'Designer repository')}>
      <PageToolbarSlot active={toolbarActive}>
        <div className="toolbar-segmented" role="group" aria-label={t(locale, '档案状态', 'Profile status')}>
          {(['all', 'published', 'draft', 'archived'] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={statusFilter === value ? 'is-active' : ''}
              aria-pressed={statusFilter === value}
              onClick={() => {
                if (onStatusFilterChange) onStatusFilterChange(value);
                else setLocalStatusFilter(value);
              }}
            >
              {value === 'all' ? t(locale, '全部', 'All') : statusLabel(locale, value)}
            </button>
          ))}
        </div>
        <label className="toolbar-search">
          <Icon name="search" size={15} />
          <span className="sr-only">{t(locale, '搜索档案', 'Search profiles')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              if (onQueryChange) onQueryChange(event.target.value);
              else setLocalQuery(event.target.value);
            }}
            placeholder={t(locale, '搜索档案', 'Search profiles')}
            aria-label={t(locale, '搜索档案', 'Search profiles')}
          />
        </label>
        {onCreate && <button type="button" className="icon-button" title={t(locale, '从作品集创建', 'Create from portfolio')} aria-label={t(locale, '从作品集创建', 'Create from portfolio')} onClick={onCreate}>
          <Icon name="plus" size={17} />
        </button>}
      </PageToolbarSlot>
      {filteredProfiles.length ? (
        <div className="persona-repository__list">
          {filteredProfiles.map((profile) => {
            const selected = profile.id === selectedId;
            return (
              <button
                type="button"
                key={profile.id}
                className={`persona-repository-card-button ${selected ? 'is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelect(profile.id)}
              >
                <DesignerProfileCard
                  locale={locale}
                  profile={profile}
                  mode="library"
                  isDefault={profile.id === activeDefaultId}
                />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="page-empty-state">
          <EmptyState
            icon="search"
            title={profiles.length === 0 ? t(locale, '暂无设计师档案', 'No designer profiles yet') : t(locale, '没有匹配档案', 'No matching profiles')}
            description={profiles.length === 0 ? t(locale, '导入作品集并完成 AI 分析后会显示在这里。', 'Import a portfolio and complete AI analysis to see profiles here.') : t(locale, '调整搜索或状态筛选。', 'Adjust search or status filters.')}
          />
        </div>
      )}
    </div>
  );
};

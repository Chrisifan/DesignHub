import { useMemo, useState } from 'react';

import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import { localize, type PersonaProfile } from './personas';
import { Badge, EmptyState, Icon, t } from './ui';

export type PersonaStatusFilter = 'all' | PersonaProfile['status'];

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
};

const statusLabel = (locale: Locale, status: PersonaProfile['status']): string =>
  status === 'published'
    ? t(locale, '已发布', 'Published')
    : status === 'built-in'
      ? t(locale, '内置', 'Built-in')
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
        statusFilter === 'all' || profile.status === statusFilter;
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
      <header className="persona-repository__head">
        <div>
          <p className="section-kicker">{t(locale, 'PERSONA REPOSITORY', 'PERSONA REPOSITORY')}</p>
          <div className="persona-repository__title-line">
            <h2>{t(locale, '设计师档案', 'Designer profiles')}</h2>
            <span className="mono persona-repository__count">{filteredProfiles.length.toString().padStart(2, '0')}</span>
          </div>
        </div>
        {onCreate && <button type="button" className="icon-button persona-repository__create" title={t(locale, '创建', 'Create')} aria-label={t(locale, '创建', 'Create')} onClick={onCreate}>
          <Icon name="plus" size={17} />
        </button>}
      </header>
      <div className="persona-repository__toolbar">
        <label className="search-control">
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
        <div className="tab-strip persona-status-tabs" role="group" aria-label={t(locale, '档案状态', 'Profile status')}>
          {(['all', 'published', 'built-in', 'draft', 'archived'] as const).map((value) => (
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
      </div>
      {filteredProfiles.length ? (
        <div className="persona-repository__list">
          {filteredProfiles.map((profile) => {
            const selected = profile.id === selectedId;
            return (
              <button
                type="button"
                key={profile.id}
                className={`persona-repository-row ${selected ? 'is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelect(profile.id)}
              >
                <span className="persona-repository-row__avatar"><PersonaArtwork personaId={profile.id} profile={profile} crop="avatar" /></span>
                <span className="persona-repository-row__body">
                  <span className="persona-repository-row__title">
                    <strong>{localize(locale, profile.name)}</strong>
                    {profile.id === activeDefaultId && <Badge tone="primary">{t(locale, '默认', 'Default')}</Badge>}
                  </span>
                  <span className="persona-repository-row__meta">
                    <span className="mono">{profile.personaCode}</span><span>{profile.version}</span><span className={`persona-status-dot persona-status-dot--${profile.status}`} />{statusLabel(locale, profile.status)}
                  </span>
                  <span className="persona-repository-row__summary">{localize(locale, profile.summary)}</span>
                  <span className="persona-repository-row__footer">
                    {profile.tags.slice(0, 3).map((tag) => (
                      <span className="persona-tag" key={`${profile.id}-${tag.zh}`}>{localize(locale, tag)}</span>
                    ))}
                    <span className="persona-repository-row__refs"><Icon name="folder" size={12} />{profile.referenceCount}</span>
                  </span>
                </span>
                <Icon name="chevron-right" size={15} />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title={t(locale, '没有匹配档案', 'No matching profiles')}
          description={t(locale, '调整搜索或状态筛选。', 'Adjust search or status filters.')}
        />
      )}
    </div>
  );
};

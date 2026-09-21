import type { WheelEvent } from 'react';

import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import { localize, type PersonaProfile } from './personas';
import { Icon, t } from './ui';

type HomeDesignerRailProps = {
  locale: Locale;
  profiles: PersonaProfile[];
  selectedId: string;
  onChange: (id: string) => void;
  onViewAll: () => void;
};

export const HomeDesignerRail = ({ locale, profiles, selectedId, onChange, onViewAll }: HomeDesignerRailProps) => {
  const available = profiles.filter((profile) => profile.status !== 'archived');
  const scrollHorizontally = (event: WheelEvent<HTMLDivElement>): void => {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    element.scrollLeft += event.deltaY;
  };

  return (
    <section className="home-designer-rail" aria-label={t(locale, '设计师灵感', 'Designer inspiration')}>
      <div className="home-designer-rail__heading">
        <div>
          <p>{t(locale, '需要灵感？', 'Need inspiration?')}</p>
          <span>{t(locale, '可选。风格只会应用于下一个项目。', 'Optional. Style applies only to the next project.')}</span>
        </div>
        <button type="button" onClick={onViewAll}>
          {t(locale, '查看全部', 'View all')}
          <Icon name="arrow-up-right" size={14} />
        </button>
      </div>
      <div className="home-designer-rail__list" onWheel={scrollHorizontally}>
        {available.map((profile) => {
          const name = localize(locale, profile.name);
          const selected = profile.id === selectedId;
          return (
            <button
              type="button"
              className={`home-designer-card ${selected ? 'is-selected' : ''}`}
              aria-label={selected ? t(locale, `取消设计师：${name}`, `Remove designer: ${name}`) : t(locale, `选择设计师：${name}`, `Select designer: ${name}`)}
              aria-pressed={selected}
              key={profile.id}
              onClick={() => onChange(selected ? '' : profile.id)}
            >
              <PersonaArtwork personaId={profile.id} profile={profile} locale={locale} crop="avatar" />
              <span>
                <strong>{name}</strong>
                <small>{localize(locale, profile.signature)}</small>
              </span>
              {selected ? <span className="home-designer-card__check"><Icon name="check" size={12} /></span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
};

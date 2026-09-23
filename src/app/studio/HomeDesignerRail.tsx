import type { WheelEvent } from 'react';

import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import { localize, type PersonaProfile } from './personas';
import { Icon, t } from './ui';

type HomeDesignerRailProps = {
  locale: Locale;
  profiles: PersonaProfile[];
  selectedId: string;
  onInspect: (profile: PersonaProfile) => void;
};

export const HomeDesignerRail = ({ locale, profiles, selectedId, onInspect }: HomeDesignerRailProps) => {
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
      </div>
      <div className="home-designer-rail__list" onWheel={scrollHorizontally}>
        {available.map((profile) => {
          const name = localize(locale, profile.name);
          const selected = profile.id === selectedId;
          return (
            <button
              type="button"
              className={`home-designer-card ${selected ? 'is-selected' : ''}`}
              aria-label={t(locale, `查看设计师档案：${name}`, `View designer profile: ${name}`)}
              key={profile.id}
              onClick={() => onInspect(profile)}
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

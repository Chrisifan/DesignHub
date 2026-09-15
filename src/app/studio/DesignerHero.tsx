import { localize, type PersonaProfile } from './personas';
import { PersonaArtwork } from './PersonaArtwork';
import { t } from './ui';
import type { Locale } from '../i18n';

type DesignerHeroProps = {
  personaId: string;
  locale: Locale;
  compact?: boolean;
  label?: string;
  profile?: PersonaProfile;
};

export const DesignerHero = ({
  locale,
  compact = false,
  label,
  profile,
}: DesignerHeroProps) => {
  const persona = profile;
  if (!persona) {
    return (
      <section
        className={`designer-hero ${compact ? 'designer-hero--compact' : ''}`}
        aria-label={label ?? t(locale, '当前设计师', 'Active designer')}
      >
        <div className="designer-hero__copy">
          <small>{t(locale, '当前设计师', 'ACTIVE DESIGNER')}</small>
          <strong>{t(locale, '未设置设计师', 'No designer selected')}</strong>
          <p>{t(locale, '创建或选择设计师档案后会显示创作原则。', 'Create or select a designer profile to show its creative principle.')}</p>
        </div>
      </section>
    );
  }
  return (
    <section
      className={`designer-hero ${compact ? 'designer-hero--compact' : ''}`}
      aria-label={label ?? t(locale, '当前设计师', 'Active designer')}
    >
      <PersonaArtwork personaId={persona.id} profile={persona} crop={compact ? 'avatar' : 'half'} />
      <div className="designer-hero__copy">
        <small>{t(locale, '当前设计师', 'ACTIVE DESIGNER')}</small>
        <strong>{localize(locale, persona.name)} · {persona.version}</strong>
        <p>{localize(locale, persona.principle)}</p>
      </div>
    </section>
  );
};

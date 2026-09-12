import { getPersona, localize, type PersonaProfile } from './personas';
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
  personaId,
  locale,
  compact = false,
  label,
  profile,
}: DesignerHeroProps) => {
  const persona = profile ?? getPersona(personaId) ?? getPersona('paper-type')!;
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

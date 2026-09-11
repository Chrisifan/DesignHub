import { getPersona, localize } from './personas';
import { PersonaArtwork } from './PersonaArtwork';
import { Icon } from './ui';
import type { Locale } from '../i18n';

type PersonaCardProps = {
  locale: Locale;
  personaId: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
};

export const PersonaCard = ({
  locale,
  personaId,
  label,
  selected,
  onSelect,
}: PersonaCardProps) => {
  const persona = getPersona(personaId);
  if (!persona) return null;
  return (
    <button
      type="button"
      className={`persona-card ${selected ? 'is-selected' : ''}`}
      aria-label={`${label} · ${localize(locale, persona.name)}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <PersonaArtwork personaId={persona.id} crop="full" />
      <span className="persona-card__body">
        <span className="persona-card__label">
          {selected && <Icon name="check" size={14} />}
          {label}
        </span>
        <strong className="persona-card__name">{localize(locale, persona.name)}</strong>
        <span className="persona-card__meta">{persona.personaCode} · {persona.version}</span>
      </span>
    </button>
  );
};

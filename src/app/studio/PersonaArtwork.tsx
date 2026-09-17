import { useState } from 'react';

import type { Locale } from '../i18n';
import type { PersonaCrop, PersonaProfile } from './personas';
import { localize } from './personas';
import { Icon, t } from './ui';

type PersonaArtworkProps = {
  personaId: string;
  crop: PersonaCrop;
  profile?: PersonaProfile;
  locale: Locale;
};

export const PersonaArtwork = ({ crop, profile, locale }: PersonaArtworkProps) => {
  const persona = profile;
  const [failed, setFailed] = useState(false);
  const onError = () => setFailed(true);
  if (!persona || failed || !persona.artworkUrl.trim()) {
    const unavailableLabel = t(locale, '设计师形象不可用', 'Designer Avatar unavailable');
    return <span
      className={`persona-artwork persona-artwork--${crop} persona-artwork--unavailable`}
      role="img"
      aria-label={unavailableLabel}
    >
      <Icon name="image" size={20} />
      <span>{failed || !persona ? unavailableLabel : t(locale, '形象待生成', 'Avatar pending')}</span>
    </span>;
  }
  const artworkAlt = localize(locale, persona.artworkAlt);
  return (
    <span className={`persona-artwork persona-artwork--${crop}`}>
      <img
        src={persona.artworkUrl}
        alt={t(locale, `${artworkAlt}的人物形象`, `${artworkAlt} designer Avatar`)}
        onError={onError}
      />
    </span>
  );
};

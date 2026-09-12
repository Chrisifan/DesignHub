import { useState } from 'react';

import { getPersona, type PersonaCrop, type PersonaProfile } from './personas';

type PersonaArtworkProps = {
  personaId: string;
  crop: PersonaCrop;
  profile?: PersonaProfile;
};

export const PersonaArtwork = ({ personaId, crop, profile }: PersonaArtworkProps) => {
  const persona = profile ?? getPersona(personaId);
  const [failed, setFailed] = useState(false);
  const onError = () => setFailed(true);
  if (!persona) {
    return <span className={`persona-artwork persona-artwork--${crop} persona-artwork--unavailable`}>形象不可用</span>;
  }
  if (failed) {
    return <span className={`persona-artwork persona-artwork--${crop} persona-artwork--unavailable`}>形象待生成</span>;
  }
  if (!persona.artworkUrl.trim()) {
    return <span className={`persona-artwork persona-artwork--${crop} persona-artwork--unavailable`}>形象待生成</span>;
  }
  return (
    <span className={`persona-artwork persona-artwork--${crop}`}>
      <img src={persona.artworkUrl} alt={`${persona.artworkAlt.zh}的人物形象`} onError={onError} />
    </span>
  );
};

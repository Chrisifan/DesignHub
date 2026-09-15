import { useEffect, useRef, type FormEvent } from 'react';

import type { Locale } from '../i18n';
import { localize, type PersonaProfile } from './personas';
import { DesignerHero } from './DesignerHero';
import { Button, Field, Icon, Select, t } from './ui';
import type { NewDesignDraft } from './types';
import { documentSizePresets } from '../../features/projects/size';

type NewDesignPageProps = {
  locale: Locale;
  draft: NewDesignDraft;
  onDraftChange: (draft: NewDesignDraft) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  persisted?: boolean;
  profiles?: PersonaProfile[];
};

export const NewDesignPage = ({
  locale,
  draft,
  onDraftChange,
  onCreate,
  onBack,
  persisted = false,
  profiles,
}: NewDesignPageProps) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameInputRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onBack();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  const setPersona = (personaId: string) =>
    onDraftChange({ ...draft, personaId });
  const personas = profiles ?? [];
  return (
    <section className="page-content new-design-page" aria-labelledby="new-design-title">
      <header className="new-design-heading">
        <div>
          <p className="section-kicker">{t(locale, '创作入口', 'CREATION ENTRY')}</p>
          <h1 id="new-design-title">{t(locale, '新建设计', 'New design')}</h1>
        </div>
      </header>
      <div className="new-design-layout">
        <form className="new-design-form" onSubmit={onCreate}>
          <Field label={t(locale, '项目名称', 'Project name')}>
            <input ref={nameInputRef} required maxLength={120} value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} />
          </Field>
          <Field label={t(locale, '设计目标', 'Creative brief')}>
            <textarea rows={6} value={draft.goal} onChange={(event) => onDraftChange({ ...draft, goal: event.target.value })} placeholder={t(locale, '用途、受众、想要传达的感受…', 'Purpose, audience, and what you want to convey…')} />
          </Field>
          <Field label={t(locale, '设计师', 'Designer')}>
            <div className="persona-selector" role="group" aria-label={t(locale, '选择设计师', 'Choose a designer')}>
              {personas.map((persona) => {
                const personaId = persona.id;
                return <button type="button" key={personaId} className={draft.personaId === personaId ? 'is-selected' : ''} aria-label={localize(locale, persona.name)} aria-pressed={draft.personaId === personaId} onClick={() => setPersona(personaId)}><span className="persona-selector__avatar"><span className="persona-artwork persona-artwork--avatar"><img src={persona.artworkUrl} alt="" /></span></span><span>{localize(locale, persona.name)}</span></button>;
              })}
            </div>
          </Field>
          <Field label={t(locale, '文档尺寸', 'Document size')}>
            <Select ariaLabel={t(locale, '文档尺寸', 'Document size')} value={draft.size} onChange={(value) => onDraftChange({ ...draft, size: value as NewDesignDraft['size'] })} options={documentSizePresets.map((size) => ({ value: size, label: size }))} />
          </Field>
          {!persisted && <p className="inline-notice"><Icon name="circle-help" size={16} />{t(locale, '此处创建预览草稿，仅本次会话可见，不写入磁盘。', 'Creates a session-only preview draft. Nothing is written to disk.')}</p>}
          <div className="dialog-actions"><Button type="submit" variant="primary" icon="plus" disabled={!draft.name.trim()}>{persisted ? t(locale, '创建项目', 'Create project') : t(locale, '创建预览', 'Create preview')}</Button></div>
        </form>
        <DesignerHero personaId={draft.personaId} profile={personas.find((persona) => persona.id === draft.personaId)} locale={locale} label={t(locale, '新建设计的当前设计师', 'New design active designer')} />
      </div>
    </section>
  );
};

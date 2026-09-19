import type { FormEvent } from 'react';

import type { Locale } from '../i18n';
import { localize, type PersonaProfile } from './personas';
import { ProjectCoverPicker } from './ProjectCoverPicker';
import { Field, Icon, Select, t } from './ui';
import type { NewDesignDraft } from './types';
import { documentSizePresets } from '../../features/projects/size';

type NewProjectFormProps = {
  locale: Locale;
  formId: string;
  draft: NewDesignDraft;
  onDraftChange: (draft: NewDesignDraft) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  persisted?: boolean;
  profiles?: PersonaProfile[];
};

export const NewProjectForm = ({
  locale,
  formId,
  draft,
  onDraftChange,
  onCreate,
  persisted = false,
  profiles,
}: NewProjectFormProps) => {
  const setPersona = (personaId: string) =>
    onDraftChange({ ...draft, personaId });
  const personas = profiles ?? [];
  return (
    <form
      id={formId}
      className="new-project-form"
      aria-label={t(locale, '新建项目表单', 'New project form')}
      onSubmit={onCreate}
    >
      <ProjectCoverPicker
        locale={locale}
        value={draft.cover}
        onChange={(cover) => onDraftChange({ ...draft, cover })}
      />
      <Field label={t(locale, '项目名称', 'Project name')}>
        <input
          data-drawer-initial-focus
          required
          maxLength={120}
          value={draft.name}
          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
        />
      </Field>
      <Field label={t(locale, '设计目标', 'Creative brief')}>
        <textarea rows={6} value={draft.goal} onChange={(event) => onDraftChange({ ...draft, goal: event.target.value })} placeholder={t(locale, '用途、受众、想要传达的感受…', 'Purpose, audience, and what you want to convey…')} />
      </Field>
      <Field label={t(locale, '设计师', 'Designer')}>
        <div className="persona-selector" role="group" aria-label={t(locale, '选择设计师', 'Choose a designer')}>
          <button type="button" className={draft.personaId ? '' : 'is-selected'} aria-label={t(locale, '不设置设计师', 'No designer')} aria-pressed={!draft.personaId} onClick={() => setPersona('')}>
            <span className="persona-selector__avatar persona-selector__avatar--empty"><Icon name="user" size={16} /></span>
            <span>{t(locale, '不设置设计师', 'No designer')}</span>
          </button>
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
    </form>
  );
};

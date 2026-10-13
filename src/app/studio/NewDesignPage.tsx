import type { FormEvent } from 'react';

import type { Locale } from '../i18n';
import { localize, type PersonaProfile } from './personas';
import { ProjectCoverPicker } from './ProjectCoverPicker';
import { Field, Icon, Select, t } from './ui';
import type { NewDesignDraft } from './types';
import { projectDesignSizePresets } from '../../features/projects/size';
import { builtInMockupTemplates } from '../../features/mockups/template';

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
      <fieldset className="creation-mode-picker" aria-label={t(locale, '创建方式', 'Creation mode')}>
        <legend>{t(locale, '创建方式', 'Creation mode')}</legend>
        {(['manual', 'composition', 'mockup'] as const).map((mode) => (
          <label key={mode}><input type="radio" name="creation-mode" checked={draft.mode === mode} onChange={() => onDraftChange({ ...draft, mode })} />
            {mode === 'manual' ? t(locale, '标准设计', 'Standard design') : mode === 'composition' ? t(locale, '智能构图', 'Intelligent composition') : t(locale, '样机', 'Mockup')}
          </label>
        ))}
      </fieldset>
      {draft.mode === 'composition' && <div className="creation-assets">
        <p className="inline-notice">{t(locale, '本地结构化构图候选，尚未经过模型验证。', 'Local structured composition candidate; no model verification yet.')}</p>
        {([['coreFile', '核心素材', 'Core asset'], ['optionalFile', '可选素材', 'Optional asset'], ['referenceFile', '参考素材', 'Reference asset']] as const).map(([key, zh, en]) => (
          <Field key={key} label={t(locale, zh, en)}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onDraftChange({ ...draft, [key]: event.target.files?.[0] })} /></Field>
        ))}
      </div>}
      {draft.mode === 'mockup' && <div className="creation-assets">
        <p className="inline-notice">{t(locale, '本地样机候选；透视和遮挡效果需人工检查。', 'Local mockup candidate; check perspective and occlusion manually.')}</p>
        <Field label={t(locale, '源设计图', 'Source artwork')}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onDraftChange({ ...draft, mockupFile: event.target.files?.[0] })} /></Field>
        <Field label={t(locale, '样机模板', 'Mockup template')}>
          <Select ariaLabel={t(locale, '样机模板', 'Mockup template')} value={draft.templateId ?? builtInMockupTemplates[0]!.id} onChange={(value) => onDraftChange({ ...draft, templateId: value, templateColor: builtInMockupTemplates.find((item) => item.id === value)?.colors[0] })} options={builtInMockupTemplates.map((template) => ({ value: template.id, label: template.category === 'phone-screen' ? t(locale, '手机屏幕', 'Phone screen') : template.category === 'poster-frame' ? t(locale, '海报画框', 'Poster frame') : t(locale, '包装袋', 'Packaging bag') }))} />
        </Field>
        <Field label={t(locale, '样机颜色', 'Mockup color')}>
          <Select ariaLabel={t(locale, '样机颜色', 'Mockup color')} value={draft.templateColor ?? builtInMockupTemplates.find((item) => item.id === (draft.templateId ?? builtInMockupTemplates[0]!.id))!.colors[0]!} onChange={(value) => onDraftChange({ ...draft, templateColor: value })} options={(builtInMockupTemplates.find((item) => item.id === (draft.templateId ?? builtInMockupTemplates[0]!.id))?.colors ?? []).map((color) => ({ value: color, label: color }))} />
        </Field>
      </div>}
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
      <Field label={t(locale, '图片尺寸', 'Image size')}>
        <Select ariaLabel={t(locale, '图片尺寸', 'Image size')} value={draft.size} onChange={(value) => onDraftChange({ ...draft, size: value as NewDesignDraft['size'] })} options={projectDesignSizePresets.map((size) => ({ value: size, label: size }))} />
      </Field>
      {!persisted && <p className="inline-notice"><Icon name="circle-help" size={16} />{t(locale, '此处创建预览草稿，仅本次会话可见，不写入磁盘。', 'Creates a session-only preview draft. Nothing is written to disk.')}</p>}
    </form>
  );
};

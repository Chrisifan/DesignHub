import { useEffect, useRef, type FormEvent } from 'react';

import type { Locale } from '../i18n';
import { getPersona, localize } from './personas';
import { DesignerHero } from './DesignerHero';
import { Button, Field, Icon, t } from './ui';
import type { NewDesignDraft } from './types';

type NewDesignPageProps = {
  locale: Locale;
  draft: NewDesignDraft;
  onDraftChange: (draft: NewDesignDraft) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
};

export const NewDesignPage = ({
  locale,
  draft,
  onDraftChange,
  onCreate,
  onBack,
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
  const setMode = (mode: NewDesignDraft['mode']) =>
    onDraftChange({ ...draft, mode });
  const setPersona = (personaId: string) =>
    onDraftChange({ ...draft, personaId });
  const personas = ['paper-type', 'clear-commerce', 'natural-story'];
  return (
    <section className="page-content new-design-page" aria-labelledby="new-design-title">
      <header className="new-design-heading">
        <Button icon="arrow-left" variant="ghost" onClick={onBack}>
          {t(locale, '返回', 'Back')}
        </Button>
        <div>
          <p className="section-kicker">{t(locale, '创作入口', 'CREATION ENTRY')}</p>
          <h1 id="new-design-title">{t(locale, '新建设计', 'New design')}</h1>
        </div>
      </header>
      <div className="new-design-layout">
        <form className="new-design-form" onSubmit={onCreate}>
          <div className="tab-strip form-tabs" role="group" aria-label={t(locale, '创建方式', 'Creation mode')}>
            <button type="button" className={draft.mode === 'manual' ? 'is-active' : ''} aria-pressed={draft.mode === 'manual'} onClick={() => setMode('manual')}>
              {t(locale, '手动填写', 'Write a brief')}
            </button>
            <button type="button" className={draft.mode === 'conversation' ? 'is-active' : ''} aria-pressed={draft.mode === 'conversation'} onClick={() => setMode('conversation')}>
              {t(locale, '通过对话', 'Start with chat')}
            </button>
          </div>
          <Field label={t(locale, '项目名称', 'Project name')}>
            <input ref={nameInputRef} required maxLength={120} value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} />
          </Field>
          {draft.mode === 'conversation' ? (
            <>
              <div className="ai-intro ai-intro--left"><Icon name="sparkles" size={20} /><h2>{t(locale, '描述你想做的设计', 'Describe the design you want')}</h2></div>
              <Field label={t(locale, '创作想法', 'Creative idea')}>
                <textarea rows={6} value={draft.brief} onChange={(event) => onDraftChange({ ...draft, brief: event.target.value })} placeholder={t(locale, '例如：春季市集宣传图', 'For example: spring market campaign')} />
              </Field>
              <p className="inline-notice"><Icon name="plug" size={16} />{t(locale, '模型未连接，想法已保留在示例草稿中。', 'No model connected. Your idea stays in this example draft.')}</p>
            </>
          ) : (
            <Field label={t(locale, '设计目标', 'Creative brief')}>
              <textarea rows={6} value={draft.goal} onChange={(event) => onDraftChange({ ...draft, goal: event.target.value })} placeholder={t(locale, '用途、受众、想要传达的感受…', 'Purpose, audience, and what you want to convey…')} />
            </Field>
          )}
          <Field label={t(locale, '设计师', 'Designer')}>
            <div className="persona-selector" role="group" aria-label={t(locale, '选择设计师', 'Choose a designer')}>
              {personas.map((personaId) => {
                const persona = getPersona(personaId)!;
                return <button type="button" key={personaId} className={draft.personaId === personaId ? 'is-selected' : ''} aria-label={localize(locale, persona.name)} aria-pressed={draft.personaId === personaId} onClick={() => setPersona(personaId)}><span className="persona-selector__avatar"><span className="persona-artwork persona-artwork--avatar persona-artwork--unavailable">{t(locale, '待生成', 'Pending')}</span></span><span>{localize(locale, persona.name)}</span></button>;
              })}
            </div>
          </Field>
          <Field label={t(locale, '文档尺寸', 'Document size')}>
            <select value={draft.size} onChange={(event) => onDraftChange({ ...draft, size: event.target.value as NewDesignDraft['size'] })}><option>1080 × 1440</option></select>
          </Field>
          <p className="inline-notice"><Icon name="circle-help" size={16} />{t(locale, '此处创建预览草稿，仅本次会话可见，不写入磁盘。', 'Creates a session-only preview draft. Nothing is written to disk.')}</p>
          <div className="dialog-actions"><Button type="submit" variant="primary" icon="plus" disabled={!draft.name.trim()}>{t(locale, '创建预览', 'Create preview')}</Button></div>
        </form>
        <DesignerHero personaId={draft.personaId} locale={locale} label={t(locale, '新建设计的当前设计师', 'New design active designer')} />
      </div>
    </section>
  );
};

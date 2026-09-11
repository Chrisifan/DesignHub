import { useState, type ChangeEvent, type FormEvent } from 'react';

import type { Locale } from '../i18n';
import { PersonaInspector } from './PersonaInspector';
import { PersonaRepository, type PersonaStatusFilter } from './PersonaRepository';
import { localize, personaProfiles, type LocalizedText, type PersonaProfile } from './personas';
import { Button, Field, Icon, Modal, PageHeader, t } from './ui';

type DesignerDraft = {
  name: string;
  signature: string;
  summary: string;
  principle: string;
  personaCode: string;
  version: string;
  tags: string;
  palette: string;
  typography: string;
  composition: string;
  texture: string;
  negativeRules: string;
};

const emptyDraft: DesignerDraft = {
  name: '', signature: '', summary: '', principle: '', personaCode: 'CUSTOM-A', version: 'v0.1',
  tags: '', palette: '#E8E4DC, #252525, #6C7A70', typography: '', composition: '', texture: '', negativeRules: '',
};

const profileToDraft = (profile: PersonaProfile, locale: Locale): DesignerDraft => ({
  name: localize(locale, profile.name),
  signature: localize(locale, profile.signature),
  summary: localize(locale, profile.summary),
  principle: localize(locale, profile.principle),
  personaCode: profile.personaCode,
  version: profile.version,
  tags: profile.tags.map((tag) => localize(locale, tag)).join(', '),
  palette: profile.styleDna.palette.join(', '),
  typography: localize(locale, profile.styleDna.typography),
  composition: localize(locale, profile.styleDna.composition),
  texture: localize(locale, profile.styleDna.texture),
  negativeRules: profile.negativeRules.map((rule) => localize(locale, rule)).join('\n'),
});

const localized = (value: string): LocalizedText => ({ zh: value, en: value });

type DesignerLibraryProps = {
  locale: Locale;
  notify: (message: string) => void;
  onUseForNew?: (personaId: string) => void;
};

export const DesignerLibrary = ({ locale, notify, onUseForNew }: DesignerLibraryProps) => {
  const [profiles, setProfiles] = useState(personaProfiles);
  const [selectedId, setSelectedId] = useState(personaProfiles[0].id);
  const [defaultId, setDefaultId] = useState(personaProfiles[0].id);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PersonaStatusFilter>('all');
  const [editor, setEditor] = useState<{ mode: 'new' } | { mode: 'edit'; profileId: string } | null>(null);
  const [newDraft, setNewDraft] = useState<DesignerDraft>(emptyDraft);
  const [editDrafts, setEditDrafts] = useState<Record<string, DesignerDraft>>({});
  const selected = profiles.find((profile) => profile.id === selectedId);
  const activeDraft = editor?.mode === 'edit' ? editDrafts[editor.profileId] ?? (selected ? profileToDraft(selected, locale) : emptyDraft) : newDraft;
  const setActiveDraft = (draft: DesignerDraft) => {
    if (editor?.mode === 'edit') setEditDrafts((previous) => ({ ...previous, [editor.profileId]: draft }));
    else setNewDraft(draft);
  };
  const openCreate = () => setEditor({ mode: 'new' });
  const openEdit = () => {
    if (!selected) return;
    setEditDrafts((previous) => previous[selected.id] ? previous : { ...previous, [selected.id]: profileToDraft(selected, locale) });
    setEditor({ mode: 'edit', profileId: selected.id });
  };
  const saveDraft = () => {
    if (!activeDraft.name.trim()) return;
    const tags = activeDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map(localized);
    const negativeRules = activeDraft.negativeRules.split('\n').map((rule) => rule.trim()).filter(Boolean).map(localized);
    const palette = activeDraft.palette.split(',').map((color) => color.trim()).filter(Boolean);
    if (editor?.mode === 'edit') {
      setProfiles((previous) => previous.map((profile) => profile.id === editor.profileId ? { ...profile, name: localized(activeDraft.name), signature: localized(activeDraft.signature), summary: localized(activeDraft.summary), principle: localized(activeDraft.principle), personaCode: activeDraft.personaCode, version: activeDraft.version, tags, styleDna: { palette, typography: localized(activeDraft.typography), composition: localized(activeDraft.composition), texture: localized(activeDraft.texture) }, negativeRules } : profile));
      notify(t(locale, '档案草稿已更新', 'Profile draft updated'));
    } else {
      const id = `custom-${crypto.randomUUID()}`;
      const profile: PersonaProfile = { id, name: localized(activeDraft.name), signature: localized(activeDraft.signature), summary: localized(activeDraft.summary), principle: localized(activeDraft.principle), personaCode: activeDraft.personaCode || 'CUSTOM-A', version: activeDraft.version || 'v0.1', status: 'draft', artworkUrl: `/personas/${id}.png`, artworkAlt: localized(activeDraft.name), tags, referenceCount: 0, styleDna: { palette, typography: localized(activeDraft.typography), composition: localized(activeDraft.composition), texture: localized(activeDraft.texture) }, negativeRules, portfolioSheets: [] };
      setProfiles((previous) => [profile, ...previous]);
      setSelectedId(id);
      notify(t(locale, '新档案已保留', 'New profile kept'));
    }
    setEditor(null);
  };
  const deleteSelected = () => {
    if (!selected || selected.status === 'built-in') return;
    setProfiles((previous) => previous.filter((profile) => profile.id !== selected.id));
    setSelectedId(defaultId === selected.id ? profiles.find((profile) => profile.id !== selected.id)?.id ?? '' : selectedId);
    notify(t(locale, '档案已移除', 'Profile removed'));
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const id = `derived-${crypto.randomUUID()}`;
    const profile: PersonaProfile = { ...selected, id, name: localized(`${localize(locale, selected.name)} ${t(locale, '派生版', 'Derived')}`), status: 'draft', version: 'v0.1', referenceCount: 0, artworkUrl: `/personas/${id}.png`, artworkAlt: localized(`${localize(locale, selected.name)} ${t(locale, '派生版', 'Derived')}`) };
    setProfiles((previous) => [profile, ...previous]);
    setSelectedId(id);
    notify(t(locale, '已创建派生档案', 'Derived profile created'));
  };
  return (
    <section className="page-content library-page designer-library-page">
      <PageHeader title={t(locale, '设计师', 'Designers')} eyebrow={t(locale, '创作档案', 'Creative profiles')} description={t(locale, '管理设计风格、人物形象与创作规则。', 'Manage style, character artwork and creative rules.')} />
      <div className="library-split library-split--designer">
        <PersonaRepository locale={locale} profiles={profiles} selectedId={selectedId} query={query} statusFilter={statusFilter} defaultId={defaultId} onQueryChange={setQuery} onStatusFilterChange={setStatusFilter} onSelect={setSelectedId} onCreate={openCreate} />
        <PersonaInspector locale={locale} profile={selected} isDefault={selectedId === defaultId} onEdit={openEdit} onDelete={deleteSelected} onDuplicate={duplicateSelected} onSetDefault={() => { setDefaultId(selectedId); notify(t(locale, '已设为会话默认', 'Set as session default')); }} onUseForNew={() => { if (onUseForNew && selected) onUseForNew(selected.id); else notify(t(locale, '请从项目库新建', 'Start a new design from Projects')); }} />
      </div>
      <p className="page-footnote"><Icon name="circle-help" size={14} />{t(locale, '人物位图尚未生成时会显示待生成；档案修改仅在本次预览保留。', 'When character bitmaps are unavailable, the UI shows a pending state; profile changes last for this preview only.')}</p>
      {editor && <DesignerEditorModal locale={locale} draft={activeDraft} mode={editor.mode} onDraftChange={setActiveDraft} onClose={() => setEditor(null)} onSubmit={saveDraft} />}
    </section>
  );
};

const DesignerEditorModal = ({ locale, draft, mode, onDraftChange, onClose, onSubmit }: { locale: Locale; draft: DesignerDraft; mode: 'new' | 'edit'; onDraftChange: (draft: DesignerDraft) => void; onClose: () => void; onSubmit: () => void }) => {
  const setField = (field: keyof DesignerDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onDraftChange({ ...draft, [field]: event.target.value });
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(); };
  return <Modal title={mode === 'new' ? t(locale, '创建设计师', 'Create designer') : t(locale, '编辑设计师', 'Edit designer')} locale={locale} onClose={onClose} wide><form className="designer-editor" onSubmit={submit}><div className="designer-form"><p className="panel-label">{t(locale, '档案草稿', 'Profile draft')}</p><Field label={t(locale, '名称', 'Name')}><input required value={draft.name} onChange={setField('name')} /></Field><Field label={t(locale, '署名', 'Signature')}><input value={draft.signature} onChange={setField('signature')} /></Field><Field label={t(locale, '风格说明', 'Style description')}><textarea rows={3} value={draft.summary} onChange={setField('summary')} /></Field><Field label={t(locale, '创作原则', 'Creative principle')}><textarea rows={3} value={draft.principle} onChange={setField('principle')} /></Field><div className="form-grid-2"><Field label={t(locale, '创意代号', 'Persona code')}><input value={draft.personaCode} onChange={setField('personaCode')} /></Field><Field label={t(locale, '版本', 'Version')}><input value={draft.version} onChange={setField('version')} /></Field></div><Field label={t(locale, '标签', 'Tags')}><input value={draft.tags} onChange={setField('tags')} placeholder={t(locale, '用逗号分隔', 'Comma separated')} /></Field><Field label={t(locale, '色板', 'Palette')}><input value={draft.palette} onChange={setField('palette')} /></Field><Field label={t(locale, '字体与构图', 'Type and composition')}><input value={draft.typography} onChange={setField('typography')} /></Field><Field label={t(locale, '材质', 'Texture')}><input value={draft.texture} onChange={setField('texture')} /></Field><Field label={t(locale, '禁用规则', 'Negative rules')}><textarea rows={3} value={draft.negativeRules} onChange={setField('negativeRules')} placeholder={t(locale, '每行一条', 'One rule per line')} /></Field></div><aside className="designer-draft-preview" aria-label={t(locale, '档案预览', 'Profile preview')}><span className="profile-mark"><Icon name="sparkles" size={22} /></span><p className="section-kicker">{t(locale, '会话草稿', 'Session draft')}</p><h3>{draft.name || t(locale, '未命名档案', 'Untitled profile')}</h3><p>{draft.summary || t(locale, '填写风格说明查看预览。', 'Add a style summary to preview it.')}</p><div className="draft-rule"><span>{t(locale, '规则', 'Rules')}</span>{draft.negativeRules || t(locale, '尚未填写', 'Not provided')}</div><small>{t(locale, '关闭后草稿仍保留在本次示例会话中。', 'Closing keeps this draft in the example session.')}</small></aside><div className="dialog-actions designer-editor-actions"><Button variant="ghost" onClick={onClose}>{t(locale, '关闭', 'Close')}</Button><Button variant="primary" icon="check" type="submit">{t(locale, '保留', 'Keep')}</Button></div></form></Modal>;
};

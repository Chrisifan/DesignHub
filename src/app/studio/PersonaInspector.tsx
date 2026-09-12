import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import { localize, type PersonaProfile } from './personas';
import { ArtworkPreview, Badge, Button, Icon, t } from './ui';

type PersonaInspectorProps = {
  locale: Locale;
  profile?: PersonaProfile;
  isDefault?: boolean;
  isSessionDefault?: boolean;
  readOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onSetDefault?: (personaId: string) => void;
  onDeriveDraft?: (personaId: string) => void;
  onUseForNew?: () => void;
  onUseForNewDesign?: (personaId: string) => void;
  onRestore?: () => void;
  canSetDefault?: boolean;
};

const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="detail-row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

export const PersonaInspector = ({
  locale,
  profile,
  isDefault = false,
  isSessionDefault,
  readOnly = false,
  onEdit,
  onDelete,
  onDuplicate,
  onSetDefault,
  onDeriveDraft,
  onUseForNew,
  onUseForNewDesign,
  onRestore,
  canSetDefault = true,
}: PersonaInspectorProps) => {
  if (!profile) {
    return (
      <aside className="details-panel persona-inspector" aria-label={t(locale, '设计师检查器', 'Designer inspector')}>
        <p className="muted">{t(locale, '选择一个设计师查看档案。', 'Select a designer to inspect the profile.')}</p>
      </aside>
    );
  }
  const sessionDefault = isSessionDefault ?? isDefault;
  const status = profile.status === 'published' ? t(locale, '已发布', 'Published') : profile.status === 'built-in' ? t(locale, '内置', 'Built-in') : profile.status === 'archived' ? t(locale, '已归档', 'Archived') : t(locale, '草稿', 'Draft');
  return (
    <aside className="details-panel persona-inspector" aria-label={t(locale, '设计师检查器', 'Designer inspector')}>
      <header className="persona-inspector__head">
        <div>
          <p className="section-kicker">{t(locale, 'PROFILE INSPECTOR', 'PROFILE INSPECTOR')}</p>
          <span className="persona-inspector__path mono"><span className="persona-inspector__path-label">{t(locale, '创意代号', 'Persona code')}</span> · {profile.personaCode} / {profile.version}</span>
        </div>
        <Badge tone={profile.status === 'published' ? 'success' : profile.status === 'draft' ? 'ai' : ''}>{status}</Badge>
      </header>
      <div className="persona-inspector__hero">
        <div className="persona-inspector__portrait"><PersonaArtwork personaId={profile.id} profile={profile} crop="half" /><span className="persona-inspector__portrait-index mono">{profile.referenceCount.toString().padStart(2, '0')}</span></div>
        <div className="persona-inspector__identity">
          <p className="persona-inspector__archetype">{t(locale, 'ARCHETYPE', 'ARCHETYPE')}</p>
          <h2>{localize(locale, profile.name)}</h2>
          <p className="persona-inspector__signature">{localize(locale, profile.signature)}</p>
          <p className="persona-inspector__code mono">{profile.personaCode} <span>/</span> {profile.version}</p>
          <p className="persona-inspector__summary">{localize(locale, profile.summary)}</p>
        </div>
      </div>
      <div className="persona-inspector__actions">
        {onEdit && <Button variant="primary" icon="settings" onClick={onEdit} disabled={readOnly}>{t(locale, '编辑', 'Edit')}</Button>}
        <Button icon="plus" onClick={() => (onUseForNewDesign ? onUseForNewDesign(profile.id) : onUseForNew?.())}>{t(locale, '用于新建', 'Use for new')}</Button>
        <Button icon="copy" onClick={() => (onDeriveDraft ? onDeriveDraft(profile.id) : onDuplicate?.())} disabled={readOnly}>{t(locale, '派生', 'Derive')}</Button>
        <Button icon="star" onClick={() => onSetDefault?.(profile.id)} disabled={readOnly || sessionDefault || !canSetDefault}>{sessionDefault ? t(locale, '当前默认', 'Current default') : t(locale, '设默认', 'Set default')}</Button>
        {profile.status === 'archived' && onRestore ? <Button icon="rotate-ccw" onClick={onRestore} disabled={readOnly}>{t(locale, '恢复', 'Restore')}</Button> : profile.status !== 'built-in' && onDelete && <Button icon="trash-2" onClick={onDelete} disabled={readOnly}>{t(locale, '删除', 'Delete')}</Button>}
      </div>
      <div className="persona-inspector__principle">
        <Icon name="sparkles" size={16} />
        <span><strong>{t(locale, '创作原则', 'Creative principle')}</strong>{localize(locale, profile.principle)}</span>
      </div>
      <div className="persona-inspector__metrics" aria-label={t(locale, '档案指标', 'Profile metrics')}>
        <div><span className="mono">{profile.referenceCount.toString().padStart(2, '0')}</span><small>{t(locale, '项目引用', 'Project refs')}</small></div>
        <div><span className="mono">{profile.portfolioSheets.length.toString().padStart(2, '0')}</span><small>{t(locale, '作品样张', 'Portfolio')}</small></div>
        <div><span className="mono">{sessionDefault ? 'ON' : 'OFF'}</span><small>{t(locale, '会话默认', 'Session default')}</small></div>
      </div>
      <div className="persona-inspector__detail-grid">
      <section className="inspector-section inspector-section--dna" aria-label={t(locale, '风格 DNA', 'Style DNA')}>
        <div className="section-title"><h3>{t(locale, 'Style DNA', 'Style DNA')}</h3><span className="mono">{t(locale, '结构化偏好', 'Structured preferences')}</span></div>
        <div className="style-palette" aria-label={t(locale, '色板', 'Palette')}>
          {profile.styleDna.palette.map((color) => <span key={color} style={{ backgroundColor: color }} title={color}><small className="mono">{color}</small></span>)}
        </div>
        <dl className="details-list details-list--compact">
          <DetailRow label={t(locale, '排版', 'Typography')}>{localize(locale, profile.styleDna.typography)}</DetailRow>
          <DetailRow label={t(locale, '构图', 'Composition')}>{localize(locale, profile.styleDna.composition)}</DetailRow>
          <DetailRow label={t(locale, '材质', 'Texture')}>{localize(locale, profile.styleDna.texture)}</DetailRow>
        </dl>
      </section>
      <section className="inspector-section inspector-section--rules" aria-label={t(locale, '禁用规则', 'Negative rules')}>
        <div className="section-title"><h3>{t(locale, '禁用规则', 'Negative Rules')}</h3><span className="mono">{profile.negativeRules.length.toString().padStart(2, '0')}</span></div>
        <ul className="negative-rules">{profile.negativeRules.map((rule) => <li key={rule.zh}>{localize(locale, rule)}</li>)}</ul>
      </section>
      </div>
      <section className="inspector-section" aria-label={t(locale, '精选作品', 'Curated portfolio')}>
        <div className="section-title"><h3>{t(locale, '精选作品', 'Curated Portfolio Sheets')}</h3><span className="mono">{profile.portfolioSheets.length.toString().padStart(2, '0')}</span></div>
        <div className="portfolio-strip">{profile.portfolioSheets.map((sheet) => <div className="portfolio-item" key={sheet.id}><ArtworkPreview kind={sheet.artwork} /><strong>{localize(locale, sheet.title)}</strong><small>{localize(locale, sheet.note)}</small></div>)}</div>
      </section>
      <p className="panel-note"><Icon name="hard-drive" size={15} />{readOnly ? t(locale, '当前工作区只读。', 'Current workspace is read-only.') : t(locale, '档案保存到当前工作区。', 'Profiles are saved to the current workspace.')}</p>
    </aside>
  );
};

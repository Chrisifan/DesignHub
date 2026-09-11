import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import { localize, type PersonaProfile } from './personas';
import { ArtworkPreview, Badge, Button, Icon, t } from './ui';

type PersonaInspectorProps = {
  locale: Locale;
  profile?: PersonaProfile;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onUseForNew: () => void;
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
  isDefault,
  onEdit,
  onDelete,
  onDuplicate,
  onSetDefault,
  onUseForNew,
}: PersonaInspectorProps) => {
  if (!profile) {
    return (
      <aside className="details-panel persona-inspector" aria-label={t(locale, '设计师检查器', 'Designer inspector')}>
        <p className="muted">{t(locale, '选择一个设计师查看档案。', 'Select a designer to inspect the profile.')}</p>
      </aside>
    );
  }
  const status = profile.status === 'published' ? t(locale, '已发布', 'Published') : profile.status === 'built-in' ? t(locale, '内置', 'Built-in') : t(locale, '草稿', 'Draft');
  return (
    <aside className="details-panel persona-inspector" aria-label={t(locale, '设计师检查器', 'Designer inspector')}>
      <div className="persona-inspector__hero">
        <PersonaArtwork personaId={profile.id} crop="half" />
        <div>
          <p className="section-kicker">{profile.personaCode} · {profile.version}</p>
          <h2>{localize(locale, profile.name)}</h2>
          <p>{localize(locale, profile.signature)}</p>
          <Badge>{status}</Badge>
        </div>
      </div>
      <div className="persona-inspector__actions">
        <Button variant="primary" icon="settings" onClick={onEdit}>{t(locale, '编辑', 'Edit')}</Button>
        <Button icon="plus" onClick={onUseForNew}>{t(locale, '用于新建', 'Use for new')}</Button>
        <Button icon="copy" onClick={onDuplicate}>{t(locale, '派生', 'Derive')}</Button>
        <Button icon="star" onClick={onSetDefault} disabled={isDefault}>{isDefault ? t(locale, '当前默认', 'Current default') : t(locale, '设默认', 'Set default')}</Button>
        {profile.status !== 'built-in' && <Button icon="trash-2" onClick={onDelete}>{t(locale, '删除', 'Delete')}</Button>}
      </div>
      <p className="details-lede">{localize(locale, profile.summary)}</p>
      <div className="persona-inspector__principle">
        <Icon name="sparkles" size={16} />
        <span><strong>{t(locale, '创作原则', 'Creative principle')}</strong>{localize(locale, profile.principle)}</span>
      </div>
      <dl className="details-list">
        <DetailRow label={t(locale, '项目引用', 'Project references')}>{profile.referenceCount} {t(locale, '个项目', 'projects')}</DetailRow>
        <DetailRow label={t(locale, '档案状态', 'Profile status')}>{status}</DetailRow>
        <DetailRow label={t(locale, '会话默认', 'Session default')}>{isDefault ? t(locale, '当前使用', 'In use') : t(locale, '未设为默认', 'Not selected')}</DetailRow>
      </dl>
      <section className="inspector-section">
        <div className="section-title"><h3>{t(locale, 'Style DNA', 'Style DNA')}</h3><span>{t(locale, '结构化偏好', 'Structured preferences')}</span></div>
        <div className="style-palette" aria-label={t(locale, '色板', 'Palette')}>
          {profile.styleDna.palette.map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}
        </div>
        <dl className="details-list details-list--compact">
          <DetailRow label={t(locale, '字体', 'Type')}>{localize(locale, profile.styleDna.typography)}</DetailRow>
          <DetailRow label={t(locale, '构图', 'Composition')}>{localize(locale, profile.styleDna.composition)}</DetailRow>
          <DetailRow label={t(locale, '材质', 'Texture')}>{localize(locale, profile.styleDna.texture)}</DetailRow>
        </dl>
      </section>
      <section className="inspector-section">
        <div className="section-title"><h3>{t(locale, '禁用规则', 'Negative rules')}</h3></div>
        <ul className="negative-rules">{profile.negativeRules.map((rule) => <li key={rule.zh}>{localize(locale, rule)}</li>)}</ul>
      </section>
      <section className="inspector-section">
        <div className="section-title"><h3>{t(locale, '精选作品', 'Selected work')}</h3><span>{profile.portfolioSheets.length}</span></div>
        <div className="portfolio-strip">{profile.portfolioSheets.map((sheet) => <div className="portfolio-item" key={sheet.id}><ArtworkPreview kind={sheet.artwork} /><strong>{localize(locale, sheet.title)}</strong><small>{localize(locale, sheet.note)}</small></div>)}</div>
      </section>
      <p className="panel-note"><Icon name="hard-drive" size={15} />{t(locale, '档案修改仅保留在本次示例会话。', 'Profile changes remain in this example session only.')}</p>
    </aside>
  );
};

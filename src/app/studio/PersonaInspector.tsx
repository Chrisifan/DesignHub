import type { Locale } from '../i18n';
import { DesignerDossier } from './DesignerProfileCard';
import { localize, type PersonaProfile } from './personas';
import { ArtworkPreview, Button, Icon, t } from './ui';

type PersonaInspectorProps = {
  locale: Locale;
  profile?: PersonaProfile;
  isDefault?: boolean;
  isSessionDefault?: boolean;
  readOnly?: boolean;
  libraryId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: (personaId: string) => void;
  onUseForNew?: () => void;
  onUseForNewDesign?: (personaId: string) => void;
  onRestore?: () => void;
  canSetDefault?: boolean;
  canUseForNew?: boolean;
  showActions?: boolean;
};

export const PersonaInspector = ({
  locale,
  profile,
  isDefault = false,
  isSessionDefault,
  readOnly = false,
  libraryId,
  onEdit,
  onDelete,
  onSetDefault,
  onUseForNew,
  onUseForNewDesign,
  onRestore,
  canSetDefault = true,
  canUseForNew = true,
  showActions = true,
}: PersonaInspectorProps) => {
  if (!profile) {
    return (
      <div className="details-panel persona-inspector">
        <p className="muted">{t(locale, '选择一个设计师查看档案。', 'Select a designer to inspect the profile.')}</p>
      </div>
    );
  }
  const sessionDefault = isSessionDefault ?? isDefault;
  const actions = (
    <div className="persona-inspector__actions">
      {onEdit && <Button variant="primary" icon="settings" onClick={onEdit} disabled={readOnly}>{t(locale, '编辑', 'Edit')}</Button>}
      <Button icon="plus" onClick={() => (onUseForNewDesign ? onUseForNewDesign(profile.id) : onUseForNew?.())} disabled={!canUseForNew}>{t(locale, '用于新建', 'Use for new')}</Button>
      <Button icon="star" onClick={() => onSetDefault?.(profile.id)} disabled={readOnly || sessionDefault || !canSetDefault}>{sessionDefault ? t(locale, '当前默认', 'Current default') : t(locale, '设默认', 'Set default')}</Button>
      {profile.status === 'archived' && onRestore ? <Button icon="rotate-ccw" onClick={onRestore} disabled={readOnly}>{t(locale, '恢复', 'Restore')}</Button> : onDelete && <Button icon="trash-2" onClick={onDelete} disabled={readOnly}>{t(locale, '删除', 'Delete')}</Button>}
    </div>
  );
  return (
    <div className="details-panel persona-inspector">
      <DesignerDossier locale={locale} profile={profile} />
      {showActions ? actions : null}
      <section className="persona-inspector__portfolio" aria-label={t(locale, '精选作品', 'Curated portfolio')}>
        <div className="section-title"><h3>{t(locale, '精选作品', 'Curated Portfolio Sheets')}</h3><span className="mono">{profile.portfolioSheets.length.toString().padStart(2, '0')}</span></div>
        {profile.portfolioSheets.length > 0 ? (
          <div className="portfolio-strip">
            {profile.portfolioSheets.map((sheet) => (
              <div className="portfolio-item" key={sheet.id}>
                <ArtworkPreview kind={sheet.artwork} />
                <strong title={localize(locale, sheet.title)}>{localize(locale, sheet.title)}</strong>
                <small title={localize(locale, sheet.note)}>{localize(locale, sheet.note)}</small>
              </div>
            ))}
          </div>
        ) : <p className="persona-inspector__empty">{t(locale, '暂无精选作品', 'No curated work yet')}</p>}
      </section>
      {(readOnly || !libraryId) && <p className="panel-note"><Icon name="hard-drive" size={15} />{readOnly ? t(locale, '当前工作区只读。', 'Current workspace is read-only.') : t(locale, '档案保存到当前工作区。', 'Profiles are saved to the current workspace.')}</p>}
    </div>
  );
};

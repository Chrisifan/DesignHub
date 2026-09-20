import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import { localize, type PersonaProfile } from './personas';
import { Tooltip } from './Tooltip';
import { Badge, Icon, t, type BadgeTone } from './ui';

type DesignerProfileCardProps = {
  locale: Locale;
  profile: PersonaProfile;
  mode: 'library' | 'review';
  isDefault?: boolean;
};

type DesignerDossierProps = {
  locale: Locale;
  profile: PersonaProfile;
};

const metricValue = (value: number | undefined): number | undefined =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value!))) : undefined;

const statusLabel = (locale: Locale, status: PersonaProfile['status']): string =>
  status === 'published' || status === 'built-in'
    ? t(locale, '已发布', 'Published')
    : status === 'archived'
      ? t(locale, '已归档', 'Archived')
      : t(locale, '草稿', 'Draft');

const statusTone = (status: PersonaProfile['status']): BadgeTone =>
  status === 'published' || status === 'built-in'
    ? 'success'
    : status === 'draft'
      ? 'ai'
      : '';

const ProfileMetric = ({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | undefined;
  compact?: boolean;
}) => {
  const normalized = metricValue(value);
  return (
    <div className={`designer-profile-metric${compact ? ' designer-profile-metric--compact' : ''}`}>
      <span>{label}</span>
      <strong>{normalized === undefined ? '--' : `${normalized}%`}</strong>
      <span
        className="designer-profile-metric__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(normalized === undefined ? {} : { 'aria-valuenow': normalized })}
      >
        <i style={{ width: `${normalized ?? 0}%` }} />
      </span>
    </div>
  );
};

const ProfileTags = ({ locale, profile, compact }: { locale: Locale; profile: PersonaProfile; compact: boolean }) => {
  const visible = compact ? profile.tags.slice(0, 2) : profile.tags;
  const hiddenCount = compact ? Math.max(0, profile.tags.length - visible.length) : 0;
  return (
    <div className="designer-profile-card__tags" aria-label={t(locale, '风格标签', 'Style tags')}>
      {visible.map((tag) => {
        const label = localize(locale, tag);
        return <span key={`${tag.zh}-${tag.en}`} title={label}>{label}</span>;
      })}
      {hiddenCount > 0 && <span className="designer-profile-card__tag-overflow">+{hiddenCount}</span>}
    </div>
  );
};

const LibraryProfile = ({ locale, profile, isDefault }: Omit<DesignerProfileCardProps, 'mode'>) => {
  const name = localize(locale, profile.name);
  const signature = localize(locale, profile.signature);
  const signals = profile.styleDna.signals;
  return (
    <article className="designer-profile-card designer-profile-card--library">
      <div className="designer-profile-card__artwork">
        <PersonaArtwork locale={locale} personaId={profile.id} profile={profile} crop="avatar" />
        <span className={`designer-profile-card__status designer-profile-card__status--${profile.status}`}>
          {statusLabel(locale, profile.status)}
        </span>
      </div>
      <div className="designer-profile-card__identity">
        <div>
          <strong title={name}>{name}</strong>
          {isDefault && <Badge tone="primary">{t(locale, '默认', 'Default')}</Badge>}
        </div>
        <span title={signature}>{signature}</span>
      </div>
      <ProfileTags locale={locale} profile={profile} compact />
      <div className="designer-profile-card__compact-metrics">
        <ProfileMetric label={t(locale, '留白占比', 'Whitespace')} value={signals?.whitespace} compact />
        <ProfileMetric label={t(locale, '漫反射率', 'Diffuse light')} value={signals?.diffuseLight} compact />
      </div>
      <small className="designer-profile-card__version mono">{profile.personaCode} / {profile.version}</small>
    </article>
  );
};

export const DesignerDossier = ({ locale, profile }: DesignerDossierProps) => {
  const name = localize(locale, profile.name);
  const signals = profile.styleDna.signals;
  return (
    <section
      className="designer-profile-card designer-profile-card--review"
      aria-label={t(locale, `${name}设计师档案`, `${name} designer profile`)}
    >
      <header className="designer-profile-card__review-head">
        <div className="designer-profile-card__review-artwork">
          <PersonaArtwork locale={locale} personaId={profile.id} profile={profile} crop="avatar" />
          <span className="designer-profile-card__active-label mono">
            <i aria-hidden="true" />{t(locale, '当前形象', 'Active Avatar')}
          </span>
        </div>
        <div className="designer-profile-card__review-identity">
          <span className="mono">{profile.personaCode} / {profile.version}</span>
          <h2>{name}</h2>
          <p>{localize(locale, profile.signature)}</p>
          <ProfileTags locale={locale} profile={profile} compact={false} />
          <Badge tone={statusTone(profile.status)}>{statusLabel(locale, profile.status)}</Badge>
        </div>
      </header>

      <section className="designer-profile-card__signals" aria-label={t(locale, '核心指标', 'Core signals')}>
        <ProfileMetric label={t(locale, '视觉对比度', 'Contrast')} value={signals?.contrast} />
        <ProfileMetric label={t(locale, '暗部透气率', 'Shadow airiness')} value={signals?.darkAiriness} />
        <ProfileMetric label={t(locale, '留白占比', 'Whitespace ratio')} value={signals?.whitespace} />
        <ProfileMetric label={t(locale, '光影漫反射率', 'Diffuse light')} value={signals?.diffuseLight} />
      </section>

      <section className="designer-profile-card__dna" aria-label="Style DNA">
        <header className="designer-profile-card__section-title">
          <Icon name="palette" size={16} />
          <h3>Style DNA</h3>
          <span className="mono">{t(locale, '结构化偏好', 'Structured preferences')}</span>
        </header>
        <div className="designer-profile-card__palette" aria-label={t(locale, '主导色板', 'Dominant palette')}>
          {profile.styleDna.palette.slice(0, 4).map((color) => (
            <span key={color}>
              <i style={{ backgroundColor: color }} aria-hidden="true" />
              <small className="mono">{color}</small>
            </span>
          ))}
        </div>
        <div className="designer-profile-card__dna-group">
          <h4>{t(locale, '排版与构图', 'Typography and composition')}</h4>
          <p>{localize(locale, profile.styleDna.typography)}</p>
          <p>{localize(locale, profile.styleDna.composition)}</p>
          {signals && <dl>
            <div><dt>{t(locale, '字体倾向', 'Type tendency')}</dt><dd>{localize(locale, signals.typeFamily)}</dd></div>
            <div><dt>{t(locale, '字重偏好', 'Weight')}</dt><dd>{localize(locale, signals.typeWeight)}</dd></div>
            <div><dt>{t(locale, '字距节奏', 'Tracking')}</dt><dd>{localize(locale, signals.tracking)}</dd></div>
            <div><dt>{t(locale, '构图拓扑', 'Topology')}</dt><dd>{localize(locale, signals.compositionTopology)}</dd></div>
          </dl>}
        </div>
        <div className="designer-profile-card__dna-group designer-profile-card__dna-group--material">
          <h4>{t(locale, '材质与光影', 'Material and light')}</h4>
          <p>{localize(locale, profile.styleDna.texture)}</p>
          {signals && <p>{localize(locale, signals.rendering)}</p>}
          <ProfileMetric label={t(locale, '纹理颗粒度', 'Grain')} value={signals?.grain} />
        </div>
      </section>

      <section className="designer-profile-card__rules" aria-label={t(locale, '否定规则', 'Negative rules')}>
        <header className="designer-profile-card__section-title">
          <Icon name="circle-alert" size={16} />
          <h3>{t(locale, '否定规则', 'Negative Rules')}</h3>
          <span className="mono">{profile.negativeRules.length.toString().padStart(2, '0')}</span>
        </header>
        {profile.negativeRules.length > 0 ? (
          <ul>
            {profile.negativeRules.map((rule) => {
              const label = localize(locale, rule);
              return <li key={`${rule.zh}-${rule.en}`}>
                <Icon name="circle-alert" size={13} />
                <Tooltip content={label} className="designer-profile-rule__text">{label}</Tooltip>
              </li>;
            })}
          </ul>
        ) : <p>{t(locale, '未提取否定规则', 'No negative rules extracted')}</p>}
      </section>
    </section>
  );
};

export const DesignerProfileCard = ({ locale, profile, mode, isDefault = false }: DesignerProfileCardProps) =>
  mode === 'library'
    ? <LibraryProfile locale={locale} profile={profile} isDefault={isDefault} />
    : <DesignerDossier locale={locale} profile={profile} />;

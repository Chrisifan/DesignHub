import type { Artwork } from '../../src/app/studio/types';

export type LocalizedText = { zh: string; en: string };
export type PersonaCrop = 'avatar' | 'half' | 'full';
export type PersonaCandidateStatus = 'idle' | 'generating' | 'ready' | 'failed';

export type PersonaProfile = {
  id: string;
  name: LocalizedText;
  signature: LocalizedText;
  summary: LocalizedText;
  principle: LocalizedText;
  personaCode: string;
  version: string;
  /** Legacy persisted states may contain `built-in`; new records never do. */
  status: 'built-in' | 'published' | 'draft' | 'archived';
  artworkAssetId?: string;
  artworkUrl: string;
  artworkAlt: LocalizedText;
  tags: LocalizedText[];
  referenceCount: number;
  styleDna: {
    palette: string[];
    typography: LocalizedText;
    composition: LocalizedText;
    texture: LocalizedText;
  };
  negativeRules: LocalizedText[];
  portfolioSheets: Array<{
    id: string;
    artwork: Artwork;
    title: LocalizedText;
    note: LocalizedText;
  }>;
};

export type PersonaCandidate = {
  id: string;
  personaId: string;
  ordinal: 1 | 2 | 3;
  status: PersonaCandidateStatus;
};

export const personaProfiles: PersonaProfile[] = [
  {
    id: 'paper-type',
    name: { zh: '纸感排版', en: 'Paper & Type' },
    signature: { zh: '春间工作室', en: 'Spring Studio' },
    summary: {
      zh: '编辑感网格、温暖纸张与克制的装饰元素。',
      en: 'Editorial grids, warm paper and restrained ornament.',
    },
    principle: {
      zh: '先建立文字层级，再让留白成为节奏。',
      en: 'Build type hierarchy first, then let whitespace set the rhythm.',
    },
    personaCode: 'INTP-A',
    version: 'v1.4',
    status: 'published',
    artworkUrl: '/personas/paper-type.png',
    artworkAlt: { zh: '纸感排版', en: 'Paper & Type' },
    tags: [
      { zh: '纸张质感', en: 'Paper texture' },
      { zh: '编辑网格', en: 'Editorial grid' },
      { zh: '克制留白', en: 'Quiet space' },
    ],
    referenceCount: 5,
    styleDna: {
      palette: ['#F4EFE7', '#24262B', '#8C7057'],
      typography: { zh: '衬线标题 · 紧凑无衬线说明', en: 'Serif titles · compact sans copy' },
      composition: { zh: '窄栏对齐 · 明确基线', en: 'Narrow-column alignment · clear baseline' },
      texture: { zh: '纸纤维 · 低对比颗粒', en: 'Paper fiber · low-contrast grain' },
    },
    negativeRules: [
      { zh: '不使用霓虹高饱和色', en: 'No neon saturation' },
      { zh: '不悬浮孤立标题', en: 'No floating captions' },
      { zh: '不打破安全边距', en: 'No broken safe margins' },
    ],
    portfolioSheets: [
      { id: 'paper-sheet-1', artwork: 'market', title: { zh: '春生特刊', en: 'Spring issue' }, note: { zh: '编辑展览海报', en: 'Editorial exhibition poster' } },
      { id: 'paper-sheet-2', artwork: 'type', title: { zh: '字形之间', en: 'Between type' }, note: { zh: '刊物封面系统', en: 'Journal cover system' } },
      { id: 'paper-sheet-3', artwork: 'objects', title: { zh: '器物档案', en: 'Object archive' }, note: { zh: '材质导向的产品页', en: 'Material-led product page' } },
    ],
  },
  {
    id: 'clear-commerce',
    name: { zh: '清晰商业', en: 'Clear Commerce' },
    signature: { zh: 'DesignHub 示例', en: 'DesignHub Example' },
    summary: {
      zh: '清楚的商品焦点、直接的信息组织与稳定节奏。',
      en: 'Clear product focus, direct information and steady rhythm.',
    },
    principle: {
      zh: '让商品先被看见，再让信息帮助决策。',
      en: 'Let the product lead, then let information support decisions.',
    },
    personaCode: 'ENTJ-B',
    version: 'v2.1',
    status: 'published',
    artworkUrl: '/personas/clear-commerce.png',
    artworkAlt: { zh: '清晰商业', en: 'Clear Commerce' },
    tags: [
      { zh: '商品聚焦', en: 'Product focus' },
      { zh: '高透明对比', en: 'Clear contrast' },
      { zh: '直接节奏', en: 'Direct rhythm' },
    ],
    referenceCount: 12,
    styleDna: {
      palette: ['#D8F1ED', '#173B43', '#4AAE9B'],
      typography: { zh: '几何无衬线 · 强调数字层级', en: 'Geometric sans · numeric hierarchy' },
      composition: { zh: '主体优先 · 模块化信息', en: 'Subject first · modular information' },
      texture: { zh: '平滑表面 · 轻微阴影', en: 'Smooth surfaces · restrained shadow' },
    },
    negativeRules: [
      { zh: '不遮挡商品主体', en: 'Never obscure the product' },
      { zh: '不使用模糊卖点', en: 'No vague selling points' },
      { zh: '不堆叠相同权重', en: 'No equal-weight clutter' },
    ],
    portfolioSheets: [
      { id: 'commerce-sheet-1', artwork: 'objects', title: { zh: '日常之物', en: 'Everyday objects' }, note: { zh: '新品视觉探索', en: 'New product direction' } },
      { id: 'commerce-sheet-2', artwork: 'market', title: { zh: '清楚上新', en: 'Clear launch' }, note: { zh: '社媒首图模板', en: 'Social launch template' } },
      { id: 'commerce-sheet-3', artwork: 'type', title: { zh: '价格与质感', en: 'Price and texture' }, note: { zh: '信息层级样张', en: 'Information hierarchy sample' } },
    ],
  },
  {
    id: 'natural-story',
    name: { zh: '自然叙事', en: 'Natural Stories' },
    signature: { zh: 'DesignHub 示例', en: 'DesignHub Example' },
    summary: {
      zh: '植物色调、轻柔拼贴与带有呼吸感的叙事构图。',
      en: 'Botanical tones, gentle collage and breathable narrative composition.',
    },
    principle: {
      zh: '保留素材的呼吸，让故事从细节自然展开。',
      en: 'Keep room for the material, and let the story unfold through detail.',
    },
    personaCode: 'ENFP-C',
    version: 'v1.2',
    status: 'published',
    artworkUrl: '/personas/natural-story.png',
    artworkAlt: { zh: '自然叙事', en: 'Natural Stories' },
    tags: [
      { zh: '植物色调', en: 'Botanical tones' },
      { zh: '轻柔拼贴', en: 'Soft collage' },
      { zh: '呼吸构图', en: 'Breathing layout' },
    ],
    referenceCount: 4,
    styleDna: {
      palette: ['#E5E8D9', '#33473A', '#B66B56'],
      typography: { zh: '人文无衬线 · 松弛行距', en: 'Humanist sans · generous leading' },
      composition: { zh: '错落层次 · 视觉动线', en: 'Layered offsets · visual path' },
      texture: { zh: '手工纸 · 柔和叠印', en: 'Handmade paper · soft overprint' },
    },
    negativeRules: [
      { zh: '不使用工业感金属渐变', en: 'No industrial metallic gradients' },
      { zh: '不裁掉关键植物细节', en: 'Do not crop key botanical detail' },
      { zh: '不把所有元素排成同一行', en: 'Do not flatten every element into one row' },
    ],
    portfolioSheets: [
      { id: 'story-sheet-1', artwork: 'market', title: { zh: '春日路径', en: 'A spring path' }, note: { zh: '活动叙事海报', en: 'Narrative event poster' } },
      { id: 'story-sheet-2', artwork: 'objects', title: { zh: '植物与器物', en: 'Botany and objects' }, note: { zh: '生活方式图像', en: 'Lifestyle image study' } },
      { id: 'story-sheet-3', artwork: 'type', title: { zh: '慢慢阅读', en: 'Read slowly' }, note: { zh: '长文案封面', en: 'Long-copy cover' } },
    ],
  },
  {
    id: 'minimal-form',
    name: { zh: '极简构成', en: 'Minimal Form' },
    signature: { zh: 'DesignHub 示例', en: 'DesignHub Example' },
    summary: {
      zh: '清晰几何、低噪层级与强调秩序的品牌构成。',
      en: 'Clear geometry, low-noise hierarchy and ordered brand composition.',
    },
    principle: {
      zh: '删除多余装饰，让结构本身成为视觉识别。',
      en: 'Remove excess ornament so structure becomes the visual signature.',
    },
    personaCode: 'ISTJ-D',
    version: 'v2.2',
    status: 'published',
    artworkUrl: '/personas/minimal-form.png',
    artworkAlt: { zh: '极简构成', en: 'Minimal Form' },
    tags: [
      { zh: '几何秩序', en: 'Geometric order' },
      { zh: '低噪层级', en: 'Low-noise hierarchy' },
      { zh: '品牌系统', en: 'Brand system' },
    ],
    referenceCount: 4,
    styleDna: {
      palette: ['#E6E8F0', '#20242D', '#7C83A8'],
      typography: { zh: '中性无衬线 · 清晰数字系统', en: 'Neutral sans · clear numeric system' },
      composition: { zh: '严格网格 · 负空间分组', en: 'Strict grid · grouped negative space' },
      texture: { zh: '平整表面 · 极细描边', en: 'Flat surface · hairline strokes' },
    },
    negativeRules: [
      { zh: '不使用无意义装饰', en: 'No ornamental noise' },
      { zh: '不混用超过两种字重', en: 'No more than two weights' },
      { zh: '不打破基础网格', en: 'Do not break the base grid' },
    ],
    portfolioSheets: [
      { id: 'minimal-sheet-1', artwork: 'type', title: { zh: '系统字标', en: 'System wordmark' }, note: { zh: '品牌识别样张', en: 'Brand identity study' } },
      { id: 'minimal-sheet-2', artwork: 'objects', title: { zh: '留白器物', en: 'Quiet object' }, note: { zh: '产品视觉规范', en: 'Product visual rules' } },
      { id: 'minimal-sheet-3', artwork: 'market', title: { zh: '城市坐标', en: 'City coordinates' }, note: { zh: '活动信息模板', en: 'Event information template' } },
    ],
  },
];

export const localize = (locale: 'zh-CN' | 'en', value: LocalizedText): string =>
  locale === 'zh-CN' ? value.zh : value.en;

export const personaCandidates: PersonaCandidate[] = [
  { id: 'candidate-paper', personaId: 'paper-type', ordinal: 1, status: 'ready' },
  { id: 'candidate-commerce', personaId: 'clear-commerce', ordinal: 2, status: 'ready' },
  { id: 'candidate-story', personaId: 'natural-story', ordinal: 3, status: 'ready' },
];

export const getPersona = (id: string): PersonaProfile | undefined =>
  personaProfiles.find((profile) => profile.id === id);

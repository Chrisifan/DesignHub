import type { Project } from '../../src/app/studio/types';
import { personaProfiles } from './personas';

const snapshot = (id: string) => structuredClone(personaProfiles.find((profile) => profile.id === id));
export const exampleProjects: Project[] = [
  {
    id: 'spring',
    name: '春间市集',
    enName: 'Spring in bloom',
    description: '春日城市市集 · 活动视觉与社媒物料',
    enDescription: 'A spring market · campaign and social visuals',
    designers: ['纸感排版', '自然叙事'],
    activeDesignerVersionId: 'paper-type',
    contributorDesignerVersionIds: ['paper-type', 'natural-story'],
    designerSnapshot: snapshot('paper-type'),
    artwork: 'market',
    documents: 3,
  },
  {
    id: 'objects',
    name: '日常之物',
    enName: 'Everyday objects',
    description: '生活方式品牌 · 新品视觉探索',
    enDescription: 'Lifestyle essentials · a new visual direction',
    designers: ['极简构成'],
    activeDesignerVersionId: 'minimal-form',
    contributorDesignerVersionIds: ['minimal-form'],
    designerSnapshot: snapshot('minimal-form'),
    artwork: 'objects',
    documents: 2,
  },
  {
    id: 'type',
    name: '字形之间',
    enName: 'Type & form',
    description: '独立设计刊物 · 封面与宣传海报',
    enDescription: 'Independent design journal · cover and posters',
    designers: ['纸感排版'],
    activeDesignerVersionId: 'paper-type',
    contributorDesignerVersionIds: ['paper-type'],
    designerSnapshot: snapshot('paper-type'),
    artwork: 'type',
    documents: 4,
  },
];

import type { Project } from './types';
export const exampleProjects: Project[] = [
  {
    id: 'spring',
    name: '春间市集',
    enName: 'Spring in bloom',
    description: '春日城市市集 · 活动视觉与社媒物料',
    enDescription: 'A spring market · campaign and social visuals',
    designers: ['纸感排版', '自然叙事'],
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
    artwork: 'type',
    documents: 4,
  },
];

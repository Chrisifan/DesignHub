import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

export type Locale = 'zh-CN' | 'en';
export type Messages = typeof zhCN;

const messages: Record<Locale, Messages> = { 'zh-CN': zhCN, en };

export const getMessages = (locale: Locale): Messages => messages[locale];

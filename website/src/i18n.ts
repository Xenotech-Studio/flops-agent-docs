import dictionary from './i18n.json'
export type Locale = 'en' | 'zh-CN'
export const localeFor = (path: string): Locale => /^\/zh-CN(?:\/|$)/.test(path) ? 'zh-CN' : 'en'
export const englishPath = (path: string) => path.replace(/^\/zh-CN(?=\/|$)/, '') || '/'
export const translate = (locale: Locale, text: string): string => (dictionary[locale] as Record<string, string>)[text] ?? text

export const SUPPORTED_LANGUAGES = ['zh-CN', 'zh-TW', 'en-US'] as const

export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English'
}

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export type MessageTree = { [key: string]: string | MessageTree }

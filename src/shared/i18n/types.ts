export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export type MessageTree = { [key: string]: string | MessageTree }

import { SUPPORTED_LANGUAGES, type AppLanguage } from './types'

export function resolveLanguage(
  saved: string | null | undefined,
  systemLocale: string | null | undefined
): AppLanguage {
  if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
    return saved as AppLanguage
  }

  const system = (systemLocale ?? '').toLowerCase().replace(/_/g, '-')
  if (
    system.startsWith('zh-tw') ||
    system.startsWith('zh-hk') ||
    system.startsWith('zh-mo') ||
    system.startsWith('zh-hant') ||
    system.includes('-hant')
  ) {
    return 'zh-TW'
  }
  if (system.startsWith('zh')) return 'zh-CN'
  return 'en-US'
}

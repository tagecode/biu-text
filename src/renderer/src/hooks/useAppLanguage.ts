import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveLanguage } from '@shared/i18n/resolve-language'
import type { AppLanguage } from '@shared/i18n/types'

function toAppLanguage(language: string | undefined): AppLanguage {
  return resolveLanguage(language, language)
}

export function useAppLanguage() {
  const { i18n } = useTranslation()
  const language = toAppLanguage(i18n.resolvedLanguage ?? i18n.language)

  const setLanguage = useCallback(
    async (next: AppLanguage) => {
      await i18n.changeLanguage(next)
      await window.languageAPI.set(next)
    },
    [i18n]
  )

  return { language, setLanguage }
}

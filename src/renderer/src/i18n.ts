import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { messages } from '@shared/i18n/messages'
import type { AppLanguage } from '@shared/i18n/types'

function initialLanguage(): AppLanguage {
  try {
    return window.languageAPI.getSync()
  } catch {
    return 'en-US'
  }
}

const language = initialLanguage()

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: messages['zh-CN'] },
    'zh-TW': { translation: messages['zh-TW'] },
    'en-US': { translation: messages['en-US'] }
  },
  lng: language,
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
  initAsync: false
})

document.documentElement.lang = language

i18n.on('languageChanged', (next) => {
  document.documentElement.lang = next
})

export default i18n

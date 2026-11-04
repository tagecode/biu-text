import type { AppLanguage } from './i18n/types'

const SEARCH_PHRASES: Record<AppLanguage, Record<string, string>> = {
  'zh-CN': {
    Find: '查找',
    Replace: '替换',
    next: '下一个',
    previous: '上一个',
    all: '全部',
    'match case': '区分大小写',
    regexp: '正则',
    'by word': '全词匹配',
    replace: '替换',
    'replace all': '全部替换',
    close: '关闭'
  },
  'zh-TW': {
    Find: '尋找',
    Replace: '取代',
    next: '下一個',
    previous: '上一個',
    all: '全部',
    'match case': '區分大小寫',
    regexp: '正則',
    'by word': '全詞比對',
    replace: '取代',
    'replace all': '全部取代',
    close: '關閉'
  },
  'en-US': {
    Find: 'Find',
    Replace: 'Replace',
    next: 'next',
    previous: 'previous',
    all: 'all',
    'match case': 'match case',
    regexp: 'regexp',
    'by word': 'by word',
    replace: 'replace',
    'replace all': 'replace all',
    close: 'close'
  }
}

export function searchPhrases(language: AppLanguage): Record<string, string> {
  return SEARCH_PHRASES[language]
}

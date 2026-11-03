import { describe, expect, it } from 'vitest'
import { readLanguagePreference } from './read-language-preference'
import { resolveLanguage } from './resolve-language'
import { translate, translateFrom, type MessageTree } from './translate'
import { messages } from './messages'
import { formatShortcut } from './format-shortcut'
import { createAppMenuTemplate, type AppMenuItem } from './menu-template'

const catalogs: Record<'zh-CN' | 'en-US', MessageTree> = {
  'zh-CN': { greet: '你好 {{name}}', empty: '' },
  'en-US': { greet: 'Hello {{name}}', empty: 'empty', onlyEn: 'Only English' }
}

function flattenKeys(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : flattenKeys(value, path)
  })
}

function labelsOf(items: AppMenuItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.label ? [item.label] : []),
    ...(item.submenu ? labelsOf(item.submenu) : [])
  ])
}

function findItem(items: AppMenuItem[], label: string): AppMenuItem | undefined {
  for (const item of items) {
    if (item.label === label) return item
    if (item.submenu) {
      const found = findItem(item.submenu, label)
      if (found) return found
    }
  }
  return undefined
}

const noop = () => {}

describe('resolveLanguage', () => {
  it('uses a saved supported language over the system locale', () => {
    expect(resolveLanguage('en-US', 'zh-CN')).toBe('en-US')
    expect(resolveLanguage('zh-CN', 'en-US')).toBe('zh-CN')
  })

  it('uses simplified Chinese for Chinese system locales when nothing is saved', () => {
    expect(resolveLanguage(null, 'zh-CN')).toBe('zh-CN')
    expect(resolveLanguage('', 'zh-TW')).toBe('zh-CN')
    expect(resolveLanguage(null, 'zh-HK')).toBe('zh-CN')
    expect(resolveLanguage(null, 'zh')).toBe('zh-CN')
    expect(resolveLanguage('fr-FR', 'zh-Hans')).toBe('zh-CN')
  })

  it('uses English for every other system locale, including when locale is missing', () => {
    expect(resolveLanguage(null, 'en')).toBe('en-US')
    expect(resolveLanguage(undefined, 'en-GB')).toBe('en-US')
    expect(resolveLanguage(null, 'ja-JP')).toBe('en-US')
    expect(resolveLanguage('fr-FR', 'ja-JP')).toBe('en-US')
    expect(resolveLanguage(null, null)).toBe('en-US')
    expect(resolveLanguage(undefined, '')).toBe('en-US')
  })
})

describe('readLanguagePreference', () => {
  it('reads the language field and ignores invalid payloads', () => {
    expect(readLanguagePreference('{"language":"en-US"}')).toBe('en-US')
    expect(readLanguagePreference('{"language":1}')).toBeNull()
    expect(readLanguagePreference('not-json')).toBeNull()
    expect(readLanguagePreference('')).toBeNull()
  })
})

describe('translate', () => {
  it('interpolates variables and keeps an explicit empty translation', () => {
    expect(translateFrom(catalogs, 'zh-CN', 'greet', { name: 'Ada' })).toBe('你好 Ada')
    expect(translateFrom(catalogs, 'en-US', 'greet')).toBe('Hello {{name}}')
    expect(translateFrom(catalogs, 'zh-CN', 'empty')).toBe('')
  })

  it('falls back to English, then to the key itself', () => {
    expect(translateFrom(catalogs, 'zh-CN', 'onlyEn')).toBe('Only English')
    expect(translateFrom(catalogs, 'en-US', 'missing.key')).toBe('missing.key')
  })

  it('keeps zh-CN and en-US catalogs aligned and serves both languages', () => {
    expect(flattenKeys(messages['zh-CN']).sort()).toEqual(flattenKeys(messages['en-US']).sort())
    expect(translate('zh-CN', 'menu.file')).toBe('文件')
    expect(translate('en-US', 'menu.file')).toBe('File')
    expect(translate('zh-CN', 'dialog.unsavedClose')).toContain('未保存')
    expect(translate('en-US', 'status.lineCol', { line: 2, col: 4 })).toBe('Ln 2, Col 4')
  })
})

describe('formatShortcut', () => {
  it('uses command symbols on macOS and Ctrl on other platforms', () => {
    expect(formatShortcut('darwin', 'N')).toBe('⌘N')
    expect(formatShortcut('darwin', 'E', true)).toBe('⌘⇧E')
    expect(formatShortcut('win32', 'S')).toBe('Ctrl+S')
    expect(formatShortcut('linux', 'P', true)).toBe('Ctrl+Shift+P')
  })
})

describe('createAppMenuTemplate', () => {
  it('builds Chinese menu labels and an empty recent-files item', () => {
    const template = createAppMenuTemplate({
      language: 'zh-CN',
      isMac: true,
      isDev: false,
      appName: 'BiuText',
      recentFiles: [],
      actions: {
        newFile: noop,
        openFile: noop,
        openRecent: noop,
        save: noop,
        saveAs: noop,
        exportHtml: noop,
        exportPdf: noop
      }
    })

    const labels = labelsOf(template)
    expect(labels).toContain('文件')
    expect(labels).toContain('新建')
    expect(labels).toContain('暂无最近文件')
    expect(labels).not.toContain('开发者工具')
    expect(findItem(template, '暂无最近文件')?.enabled).toBe(false)
  })

  it('builds English labels and opens the selected recent file', () => {
    const opened: string[] = []
    const template = createAppMenuTemplate({
      language: 'en-US',
      isMac: true,
      isDev: true,
      appName: 'BiuText',
      recentFiles: [{ path: '/tmp/a.md', label: 'a.md' }],
      actions: {
        newFile: noop,
        openFile: noop,
        openRecent: (path) => opened.push(path),
        save: noop,
        saveAs: noop,
        exportHtml: noop,
        exportPdf: noop
      }
    })

    expect(labelsOf(template)).toEqual(
      expect.arrayContaining(['File', 'New', 'Recent Files', 'a.md', 'Developer Tools', 'About BiuText'])
    )
    findItem(template, 'a.md')?.click?.()
    expect(opened).toEqual(['/tmp/a.md'])
  })
})

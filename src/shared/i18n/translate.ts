import { messages } from './messages'
import type { AppLanguage, MessageTree } from './types'

export type { MessageTree }

function lookup(tree: MessageTree | undefined, key: string): string | undefined {
  if (!tree) return undefined
  let current: string | MessageTree | undefined = tree
  for (const part of key.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}

export function translateFrom(
  catalogs: Record<AppLanguage, MessageTree>,
  language: AppLanguage,
  key: string,
  vars?: Record<string, string | number>
): string {
  const primary = lookup(catalogs[language], key)
  const value = primary !== undefined ? primary : lookup(catalogs['en-US'], key)
  if (value === undefined) return key
  return interpolate(value, vars)
}

export function translate(
  language: AppLanguage,
  key: string,
  vars?: Record<string, string | number>
): string {
  return translateFrom(messages, language, key, vars)
}

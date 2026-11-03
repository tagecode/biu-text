export const TAB_WIDTHS = [2, 4, 8] as const
export type TabWidth = (typeof TAB_WIDTHS)[number]

export const AUTO_SAVE_SECONDS = [0, 30, 60, 300] as const
export type AutoSaveSeconds = (typeof AUTO_SAVE_SECONDS)[number]

export const DEFAULT_LINE_HEIGHT = 1.4
export const MIN_LINE_HEIGHT = 1.2
export const MAX_LINE_HEIGHT = 2

export interface EditorPreferences {
  tabWidth: TabWidth
  lineHeight: number
  showLineNumbers: boolean
  autoSaveSeconds: AutoSaveSeconds
}

export function normalizeTabWidth(value: unknown): TabWidth {
  return value === 4 || value === 8 ? value : 2
}

export function normalizeLineHeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LINE_HEIGHT
  const stepped = Math.round(value * 10) / 10
  return Math.min(MAX_LINE_HEIGHT, Math.max(MIN_LINE_HEIGHT, stepped))
}

export function normalizeShowLineNumbers(value: unknown): boolean {
  return value === false ? false : true
}

export function normalizeAutoSaveSeconds(value: unknown): AutoSaveSeconds {
  return value === 30 || value === 60 || value === 300 ? value : 0
}

export function readEditorPreferences(
  parsed: Partial<Record<keyof EditorPreferences, unknown>> | null
): EditorPreferences {
  return {
    tabWidth: normalizeTabWidth(parsed?.tabWidth),
    lineHeight: normalizeLineHeight(parsed?.lineHeight),
    showLineNumbers: normalizeShowLineNumbers(parsed?.showLineNumbers),
    autoSaveSeconds: normalizeAutoSaveSeconds(parsed?.autoSaveSeconds)
  }
}

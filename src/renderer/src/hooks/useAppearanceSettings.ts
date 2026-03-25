import { useEffect, useState } from 'react'

export type EditorFontFamily = 'jetbrains-mono' | 'fira-code' | 'menlo'
export type PreviewFontFamily = 'sans' | 'serif'
export type PreviewTheme = 'github' | 'notion'

interface AppearanceState {
  editorFontFamily: EditorFontFamily
  previewFontFamily: PreviewFontFamily
  fontSize: number
  previewTheme: PreviewTheme
}

const STORAGE_KEY = 'biu-text:appearance'
const DEFAULT_APPEARANCE: AppearanceState = {
  editorFontFamily: 'jetbrains-mono',
  previewFontFamily: 'sans',
  fontSize: 14,
  previewTheme: 'github'
}

function normalizeFontSize(value: number): number {
  return Math.min(24, Math.max(12, Math.round(value)))
}

function readStoredAppearance(): AppearanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE

    const parsed = JSON.parse(raw) as Partial<AppearanceState>
    return {
      editorFontFamily:
        parsed.editorFontFamily === 'fira-code' || parsed.editorFontFamily === 'menlo'
          ? parsed.editorFontFamily
          : DEFAULT_APPEARANCE.editorFontFamily,
      previewFontFamily:
        parsed.previewFontFamily === 'serif' ? 'serif' : DEFAULT_APPEARANCE.previewFontFamily,
      fontSize:
        typeof parsed.fontSize === 'number'
          ? normalizeFontSize(parsed.fontSize)
          : DEFAULT_APPEARANCE.fontSize,
      previewTheme: parsed.previewTheme === 'notion' ? 'notion' : DEFAULT_APPEARANCE.previewTheme
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function useAppearanceSettings() {
  const [appearance, setAppearance] = useState<AppearanceState>(readStoredAppearance)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
    } catch {
      // ignore storage failures
    }
  }, [appearance])

  return {
    ...appearance,
    setEditorFontFamily: (editorFontFamily: EditorFontFamily) =>
      setAppearance((prev) => ({ ...prev, editorFontFamily })),
    setPreviewFontFamily: (previewFontFamily: PreviewFontFamily) =>
      setAppearance((prev) => ({ ...prev, previewFontFamily })),
    setFontSize: (fontSize: number) =>
      setAppearance((prev) => ({ ...prev, fontSize: normalizeFontSize(fontSize) })),
    setPreviewTheme: (previewTheme: PreviewTheme) =>
      setAppearance((prev) => ({ ...prev, previewTheme }))
  }
}

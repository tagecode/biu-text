import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppLanguage } from '@/hooks/useAppLanguage'
import type { AppLanguage } from '@shared/i18n/types'
import type {
  EditorFontFamily,
  PreviewFontFamily,
  PreviewTheme
} from '@/hooks/useAppearanceSettings'
import type { ThemeMode } from '@/hooks/useTheme'

interface SettingsPanelProps {
  open: boolean
  themeMode: ThemeMode
  editorFontFamily: EditorFontFamily
  previewFontFamily: PreviewFontFamily
  fontSize: number
  previewTheme: PreviewTheme
  onClose: () => void
  onThemeModeChange: (value: ThemeMode) => void
  onEditorFontFamilyChange: (value: EditorFontFamily) => void
  onPreviewFontFamilyChange: (value: PreviewFontFamily) => void
  onFontSizeChange: (value: number) => void
  onPreviewThemeChange: (value: PreviewTheme) => void
}

export function SettingsPanel({
  open,
  themeMode,
  editorFontFamily,
  previewFontFamily,
  fontSize,
  previewTheme,
  onClose,
  onThemeModeChange,
  onEditorFontFamilyChange,
  onPreviewFontFamilyChange,
  onFontSizeChange,
  onPreviewThemeChange
}: SettingsPanelProps) {
  const { t } = useTranslation()
  const { language, setLanguage } = useAppLanguage()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t('settings.title')}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            aria-label={t('settings.closePanel')}
            title={t('settings.close')}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SettingField label={t('settings.language')}>
              <select
                className="toolbar-select w-full"
                value={language}
                onChange={(e) => {
                  void setLanguage(e.target.value as AppLanguage)
                }}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </SettingField>
          </div>

          <SettingField label={t('settings.themeMode')}>
            <select
              className="toolbar-select w-full"
              value={themeMode}
              onChange={(e) => onThemeModeChange(e.target.value as ThemeMode)}
            >
              <option value="light">{t('appearance.light')}</option>
              <option value="dark">{t('appearance.dark')}</option>
              <option value="system">{t('appearance.system')}</option>
            </select>
          </SettingField>

          <SettingField label={t('settings.editorFont')}>
            <select
              className="toolbar-select w-full"
              value={editorFontFamily}
              onChange={(e) => onEditorFontFamilyChange(e.target.value as EditorFontFamily)}
            >
              <option value="jetbrains-mono">JetBrains Mono</option>
              <option value="fira-code">Fira Code</option>
              <option value="menlo">Menlo</option>
            </select>
          </SettingField>

          <SettingField label={t('settings.previewFont')}>
            <select
              className="toolbar-select w-full"
              value={previewFontFamily}
              onChange={(e) => onPreviewFontFamilyChange(e.target.value as PreviewFontFamily)}
            >
              <option value="sans">{t('settings.sans')}</option>
              <option value="serif">{t('settings.serif')}</option>
            </select>
          </SettingField>

          <SettingField label={t('settings.previewTheme')}>
            <select
              className="toolbar-select w-full"
              value={previewTheme}
              onChange={(e) => onPreviewThemeChange(e.target.value as PreviewTheme)}
            >
              <option value="github">GitHub</option>
              <option value="notion">Notion</option>
            </select>
          </SettingField>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">{t('settings.fontSize')}</span>
              <input
                className="toolbar-range flex-1"
                aria-label={t('settings.adjustFontSize')}
                type="range"
                min={12}
                max={24}
                step={1}
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
              />
              <span className="w-10 text-right tabular-nums">{fontSize}px</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppLanguage } from '@/hooks/useAppLanguage'
import { LANGUAGE_NAMES, type AppLanguage } from '@shared/i18n/types'
import type {
  EditorFontFamily,
  PreviewFontFamily,
  PreviewTheme
} from '@/hooks/useAppearanceSettings'
import { AUTO_SAVE_SECONDS, TAB_WIDTHS, type AutoSaveSeconds, type TabWidth } from '@shared/editor-preferences'
import type { ThemeMode } from '@/hooks/useTheme'

interface SettingsPanelProps {
  open: boolean
  themeMode: ThemeMode
  editorFontFamily: EditorFontFamily
  previewFontFamily: PreviewFontFamily
  fontSize: number
  previewTheme: PreviewTheme
  tabWidth: TabWidth
  lineHeight: number
  showLineNumbers: boolean
  autoSaveSeconds: AutoSaveSeconds
  openAtLogin: boolean
  onClose: () => void
  onThemeModeChange: (value: ThemeMode) => void
  onEditorFontFamilyChange: (value: EditorFontFamily) => void
  onPreviewFontFamilyChange: (value: PreviewFontFamily) => void
  onFontSizeChange: (value: number) => void
  onPreviewThemeChange: (value: PreviewTheme) => void
  onTabWidthChange: (value: TabWidth) => void
  onLineHeightChange: (value: number) => void
  onShowLineNumbersChange: (value: boolean) => void
  onAutoSaveSecondsChange: (value: AutoSaveSeconds) => void
  onOpenAtLoginChange: (value: boolean) => void
}

export function SettingsPanel({
  open,
  themeMode,
  editorFontFamily,
  previewFontFamily,
  fontSize,
  previewTheme,
  tabWidth,
  lineHeight,
  showLineNumbers,
  autoSaveSeconds,
  openAtLogin,
  onClose,
  onThemeModeChange,
  onEditorFontFamilyChange,
  onPreviewFontFamilyChange,
  onFontSizeChange,
  onPreviewThemeChange,
  onTabWidthChange,
  onLineHeightChange,
  onShowLineNumbersChange,
  onAutoSaveSecondsChange,
  onOpenAtLoginChange
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

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2">
          <h3 className="sm:col-span-2 text-xs font-medium text-foreground">{t('settings.generalSection')}</h3>
          <div className="sm:col-span-2">
            <SettingField label={t('settings.language')}>
              <select
                className="toolbar-select w-full"
                value={language}
                onChange={(e) => {
                  void setLanguage(e.target.value as AppLanguage)
                }}
              >
                <option value="zh-CN">{LANGUAGE_NAMES['zh-CN']}</option>
                <option value="zh-TW">{LANGUAGE_NAMES['zh-TW']}</option>
                <option value="en-US">{LANGUAGE_NAMES['en-US']}</option>
              </select>
            </SettingField>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={openAtLogin}
              onChange={(e) => onOpenAtLoginChange(e.target.checked)}
            />
            {t('settings.openAtLogin')}
          </label>

          <div className="sm:col-span-2">
            <SettingField label={t('settings.autoSave')}>
              <select
                className="toolbar-select w-full"
                value={autoSaveSeconds}
                onChange={(e) => onAutoSaveSecondsChange(Number(e.target.value) as AutoSaveSeconds)}
              >
                {AUTO_SAVE_SECONDS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {t(autoSaveLabelKey(seconds))}
                  </option>
                ))}
              </select>
            </SettingField>
          </div>

          <h3 className="sm:col-span-2 text-xs font-medium text-foreground">{t('settings.editorSection')}</h3>

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

          <SettingField label={t('settings.tabWidth')}>
            <select
              className="toolbar-select w-full"
              value={tabWidth}
              onChange={(e) => onTabWidthChange(Number(e.target.value) as TabWidth)}
            >
              {TAB_WIDTHS.map((width) => (
                <option key={width} value={width}>
                  {width}
                </option>
              ))}
            </select>
          </SettingField>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">{t('settings.lineHeight')}</span>
              <input
                className="toolbar-range flex-1"
                aria-label={t('settings.lineHeight')}
                type="range"
                min={1.2}
                max={2}
                step={0.1}
                value={lineHeight}
                onChange={(e) => onLineHeightChange(Number(e.target.value))}
              />
              <span className="w-10 text-right tabular-nums">{lineHeight.toFixed(1)}</span>
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={showLineNumbers}
              onChange={(e) => onShowLineNumbersChange(e.target.checked)}
            />
            {t('settings.showLineNumbers')}
          </label>
        </div>
      </div>
    </div>
  )
}

function autoSaveLabelKey(seconds: AutoSaveSeconds): string {
  if (seconds === 30) return 'settings.autoSave30'
  if (seconds === 60) return 'settings.autoSave60'
  if (seconds === 300) return 'settings.autoSave300'
  return 'settings.autoSaveOff'
}

function SettingField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

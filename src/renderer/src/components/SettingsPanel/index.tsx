import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useAppLanguage } from '@/hooks/useAppLanguage'
import { LANGUAGE_NAMES, type AppLanguage } from '@shared/i18n/types'
import type {
  EditorFontFamily,
  PreviewFontFamily,
  PreviewTheme
} from '@/hooks/useAppearanceSettings'
import { AUTO_SAVE_SECONDS, TAB_WIDTHS, type AutoSaveSeconds, type TabWidth } from '@shared/editor-preferences'
import type { ThemeMode } from '@/hooks/useTheme'
import type { ImageHostConfigView } from '@shared/image-host'
import { toast } from '@/lib/toast-store'
import { ImageHostSettings, type ImageHostSettingsHandle } from './ImageHostSettings'

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
  inlineRender: boolean
  autoSaveSeconds: AutoSaveSeconds
  openAtLogin: boolean
  imageHost: ImageHostConfigView | null
  onClose: () => void
  onThemeModeChange: (value: ThemeMode) => void
  onEditorFontFamilyChange: (value: EditorFontFamily) => void
  onPreviewFontFamilyChange: (value: PreviewFontFamily) => void
  onFontSizeChange: (value: number) => void
  onPreviewThemeChange: (value: PreviewTheme) => void
  onTabWidthChange: (value: TabWidth) => void
  onLineHeightChange: (value: number) => void
  onShowLineNumbersChange: (value: boolean) => void
  onInlineRenderChange: (value: boolean) => void
  onAutoSaveSecondsChange: (value: AutoSaveSeconds) => void
  onOpenAtLoginChange: (value: boolean) => void
  onSaveImageHost: (view: ImageHostConfigView) => Promise<void>
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
  inlineRender,
  autoSaveSeconds,
  openAtLogin,
  imageHost,
  onClose,
  onThemeModeChange,
  onEditorFontFamilyChange,
  onPreviewFontFamilyChange,
  onFontSizeChange,
  onPreviewThemeChange,
  onTabWidthChange,
  onLineHeightChange,
  onShowLineNumbersChange,
  onInlineRenderChange,
  onAutoSaveSecondsChange,
  onOpenAtLoginChange,
  onSaveImageHost
}: SettingsPanelProps) {
  const { t } = useTranslation()
  const { language, setLanguage } = useAppLanguage()
  const imageSettingsRef = useRef<ImageHostSettingsHandle>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      // 语言、外观、编辑器在修改时已经记下；这里一并提交图床草稿
      const saved = await imageSettingsRef.current?.save()
      if (saved) toast({ level: 'success', title: t('settings.saved') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label={t('settings.closePanel')}>
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2">
          <h3 className="text-xs font-medium sm:col-span-2">{t('settings.generalSection')}</h3>

          <SettingField id="setting-language" label={t('settings.language')} className="sm:col-span-2">
            <Select value={language} onValueChange={(value) => void setLanguage(value as AppLanguage)}>
              <SelectTrigger id="setting-language" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['zh-CN', 'zh-TW', 'en-US'] as const).map((code) => (
                  <SelectItem key={code} value={code}>
                    {LANGUAGE_NAMES[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingField>

          <SettingRow>
            <Label htmlFor="setting-open-at-login" className="text-xs font-normal text-muted-foreground">
              {t('settings.openAtLogin')}
            </Label>
            <Switch
              id="setting-open-at-login"
              checked={openAtLogin}
              onCheckedChange={onOpenAtLoginChange}
            />
          </SettingRow>

          <SettingField id="setting-auto-save" label={t('settings.autoSave')} className="sm:col-span-2">
            <Select
              value={String(autoSaveSeconds)}
              onValueChange={(value) => onAutoSaveSecondsChange(Number(value) as AutoSaveSeconds)}
            >
              <SelectTrigger id="setting-auto-save" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_SAVE_SECONDS.map((seconds) => (
                  <SelectItem key={seconds} value={String(seconds)}>
                    {t(autoSaveLabelKey(seconds))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingField>

          <h3 className="text-xs font-medium sm:col-span-2">{t('settings.editorSection')}</h3>

          <SettingField id="setting-theme-mode" label={t('settings.themeMode')}>
            <Select value={themeMode} onValueChange={(value) => onThemeModeChange(value as ThemeMode)}>
              <SelectTrigger id="setting-theme-mode" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('appearance.light')}</SelectItem>
                <SelectItem value="dark">{t('appearance.dark')}</SelectItem>
                <SelectItem value="system">{t('appearance.system')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingField>

          <SettingField id="setting-editor-font" label={t('settings.editorFont')}>
            <Select
              value={editorFontFamily}
              onValueChange={(value) => onEditorFontFamilyChange(value as EditorFontFamily)}
            >
              <SelectTrigger id="setting-editor-font" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jetbrains-mono">JetBrains Mono</SelectItem>
                <SelectItem value="fira-code">Fira Code</SelectItem>
                <SelectItem value="menlo">Menlo</SelectItem>
              </SelectContent>
            </Select>
          </SettingField>

          <SettingField id="setting-preview-font" label={t('settings.previewFont')}>
            <Select
              value={previewFontFamily}
              onValueChange={(value) => onPreviewFontFamilyChange(value as PreviewFontFamily)}
            >
              <SelectTrigger id="setting-preview-font" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">{t('settings.sans')}</SelectItem>
                <SelectItem value="serif">{t('settings.serif')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingField>

          <SettingField id="setting-preview-theme" label={t('settings.previewTheme')}>
            <Select
              value={previewTheme}
              onValueChange={(value) => onPreviewThemeChange(value as PreviewTheme)}
            >
              <SelectTrigger id="setting-preview-theme" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github">GitHub</SelectItem>
                <SelectItem value="notion">Notion</SelectItem>
              </SelectContent>
            </Select>
          </SettingField>

          <SettingSlider
            label={t('settings.fontSize')}
            ariaLabel={t('settings.adjustFontSize')}
            value={fontSize}
            min={12}
            max={24}
            step={1}
            display={`${fontSize}px`}
            onChange={onFontSizeChange}
          />

          <SettingSlider
            label={t('settings.lineHeight')}
            ariaLabel={t('settings.lineHeight')}
            value={lineHeight}
            min={1.2}
            max={2}
            step={0.1}
            display={lineHeight.toFixed(1)}
            onChange={onLineHeightChange}
          />

          <SettingField id="setting-tab-width" label={t('settings.tabWidth')}>
            <Select
              value={String(tabWidth)}
              onValueChange={(value) => onTabWidthChange(Number(value) as TabWidth)}
            >
              <SelectTrigger id="setting-tab-width" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAB_WIDTHS.map((width) => (
                  <SelectItem key={width} value={String(width)}>
                    {width}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingField>

          <SettingRow>
            <Label htmlFor="setting-line-numbers" className="text-xs font-normal text-muted-foreground">
              {t('settings.showLineNumbers')}
            </Label>
            <Switch
              id="setting-line-numbers"
              checked={showLineNumbers}
              onCheckedChange={onShowLineNumbersChange}
            />
          </SettingRow>

          <SettingRow>
            <Label htmlFor="setting-inline-render" className="text-xs font-normal text-muted-foreground">
              {t('settings.inlineRender')}
            </Label>
            <Switch
              id="setting-inline-render"
              checked={inlineRender}
              onCheckedChange={onInlineRenderChange}
            />
          </SettingRow>

          <h3 className="text-xs font-medium sm:col-span-2">{t('settings.imageSection')}</h3>

          <ImageHostSettings ref={imageSettingsRef} config={imageHost} onSave={onSaveImageHost} />
        </div>

        <div className="flex justify-end border-t px-4 py-3">
          <Button size="sm" disabled={saving || !imageHost} onClick={() => void handleSave()}>
            {t('settings.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function autoSaveLabelKey(seconds: AutoSaveSeconds): string {
  if (seconds === 30) return 'settings.autoSave30'
  if (seconds === 60) return 'settings.autoSave60'
  if (seconds === 300) return 'settings.autoSave300'
  return 'settings.autoSaveOff'
}

function SettingField({
  id,
  label,
  className,
  children
}: {
  id: string
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ''}`}>
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function SettingRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between gap-2 sm:col-span-2">{children}</div>
}

function SettingSlider({
  label,
  ariaLabel,
  value,
  min,
  max,
  step,
  display,
  onChange
}: {
  label: string
  ariaLabel: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-3 sm:col-span-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <Slider
        className="flex-1"
        thumbLabel={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{display}</span>
    </div>
  )
}

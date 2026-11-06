import type { ReactNode } from 'react'
import {
  FilePlus,
  FolderOpen,
  Save,
  Download,
  FileText,
  PanelRightOpen,
  PanelRightClose,
  Settings,
  Bold,
  Italic,
  Code,
  Link,
  ImagePlus
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ThemeMode } from '@/hooks/useTheme'
import type { WordCountResult } from '@/hooks/useWordCount'
import { formatShortcut } from '@shared/i18n/format-shortcut'

interface ToolbarProps {
  themeMode: ThemeMode
  onNewFile: () => void
  onOpenFile: () => void
  onSaveFile: () => void
  onExportHtml: () => void
  onExportPdf: () => void
  previewVisible: boolean
  onTogglePreviewVisible: () => void
  onBold: () => void
  onItalic: () => void
  onCode: () => void
  onLink: () => void
  onInsertImage: () => void
  onOpenSettings: () => void
  wordCount: WordCountResult
}

// macOS hiddenInset 时红绿灯按钮宽度约 76px，需预留安全边距避免遮挡
const isMac = window.windowAPI?.platform === 'darwin'

export function Toolbar({
  themeMode,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onExportHtml,
  onExportPdf,
  previewVisible,
  onTogglePreviewVisible,
  onBold,
  onItalic,
  onCode,
  onLink,
  onInsertImage,
  onOpenSettings,
  wordCount
}: ToolbarProps) {
  const { t } = useTranslation()
  const platform = window.windowAPI?.platform ?? 'darwin'
  const shortcut = (key: string, shift = false) => ` (${formatShortcut(platform, key, shift)})`
  const themeLabel = t(
    themeMode === 'system' ? 'appearance.system' : themeMode === 'dark' ? 'appearance.dark' : 'appearance.light'
  )
  const previewLabel = previewVisible ? t('toolbar.hidePreview') : t('toolbar.showPreview')

  return (
    <div
      className={`drag-region flex items-center gap-0.5 h-11 shrink-0 border-b bg-background select-none ${isMac ? 'pl-[80px] pr-2' : 'px-2'}`}
    >
      {/* 文件操作 */}
      <ToolbarButton label={t('toolbar.new')} hint={shortcut('N')} onClick={onNewFile}>
        <FilePlus className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.open')} hint={shortcut('O')} onClick={onOpenFile}>
        <FolderOpen className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.save')} hint={shortcut('S')} onClick={onSaveFile}>
        <Save className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.exportHtml')} hint={shortcut('E', true)} onClick={onExportHtml}>
        <FileText className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.exportPdf')} hint={shortcut('P', true)} onClick={onExportPdf}>
        <Download className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={previewLabel} onClick={onTogglePreviewVisible}>
        {previewVisible ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.openSettings')}
        hint={` (${themeLabel})`}
        onClick={onOpenSettings}
      >
        <Settings className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-4 mx-1.5" />

      {/* 格式化快捷键 */}
      <ToolbarButton label={t('toolbar.bold')} hint={shortcut('B')} onClick={onBold}>
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.italic')} hint={shortcut('I')} onClick={onItalic}>
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.code')} hint={shortcut('`')} onClick={onCode}>
        <Code className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.link')} hint={shortcut('K')} onClick={onLink}>
        <Link className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.insertImage')} onClick={onInsertImage}>
        <ImagePlus className="size-3.5" />
      </ToolbarButton>

      {/* 右侧：字数统计摘要 */}
      <div className="no-drag-region ml-auto">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('toolbar.wordSummary', { words: wordCount.words, chars: wordCount.chars })}
        </span>
      </div>
    </div>
  )
}

function ToolbarButton({
  label,
  hint,
  onClick,
  children
}: {
  label: string
  hint?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="no-drag-region size-7"
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}

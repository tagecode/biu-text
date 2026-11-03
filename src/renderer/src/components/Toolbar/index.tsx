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
  Link
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
  onOpenSettings,
  wordCount
}: ToolbarProps) {
  const { t } = useTranslation()
  const platform = window.windowAPI?.platform ?? 'darwin'
  const shortcut = (key: string, shift = false) => formatShortcut(platform, key, shift)
  const themeLabel = t(
    themeMode === 'system' ? 'appearance.system' : themeMode === 'dark' ? 'appearance.dark' : 'appearance.light'
  )
  const previewLabel = previewVisible ? t('toolbar.hidePreview') : t('toolbar.showPreview')

  return (
    <div
      className={`drag-region flex items-center gap-0.5 h-11 shrink-0 border-b bg-background select-none ${isMac ? 'pl-[80px] pr-2' : 'px-2'}`}
    >
      {/* 文件操作 */}
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onNewFile}
        aria-label={t('toolbar.new')}
        title={`${t('toolbar.new')} (${shortcut('N')})`}
      >
        <FilePlus className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onOpenFile}
        aria-label={t('toolbar.open')}
        title={`${t('toolbar.open')} (${shortcut('O')})`}
      >
        <FolderOpen className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onSaveFile}
        aria-label={t('toolbar.save')}
        title={`${t('toolbar.save')} (${shortcut('S')})`}
      >
        <Save className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onExportHtml}
        aria-label={t('toolbar.exportHtml')}
        title={`${t('toolbar.exportHtml')} (${shortcut('E', true)})`}
      >
        <FileText className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onExportPdf}
        aria-label={t('toolbar.exportPdf')}
        title={`${t('toolbar.exportPdf')} (${shortcut('P', true)})`}
      >
        <Download className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onTogglePreviewVisible}
        aria-label={previewLabel}
        title={previewLabel}
      >
        {previewVisible ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onOpenSettings}
        aria-label={t('toolbar.openSettings')}
        title={t('toolbar.settingsCurrent', { theme: themeLabel })}
      >
        <Settings className="size-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-4 mx-1.5" />

      {/* 格式化快捷键 */}
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onBold}
        aria-label={t('toolbar.bold')}
        title={`${t('toolbar.bold')} (${shortcut('B')})`}
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onItalic}
        aria-label={t('toolbar.italic')}
        title={`${t('toolbar.italic')} (${shortcut('I')})`}
      >
        <Italic className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onCode}
        aria-label={t('toolbar.code')}
        title={`${t('toolbar.code')} (${shortcut('`')})`}
      >
        <Code className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onLink}
        aria-label={t('toolbar.link')}
        title={`${t('toolbar.link')} (${shortcut('K')})`}
      >
        <Link className="size-3.5" />
      </Button>

      {/* 右侧：字数统计摘要 */}
      <div className="no-drag-region ml-auto">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('toolbar.wordSummary', { words: wordCount.words, chars: wordCount.chars })}
        </span>
      </div>
    </div>
  )
}

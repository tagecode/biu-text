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
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ThemeMode } from '@/hooks/useTheme'
import type { WordCountResult } from '@/hooks/useWordCount'

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
        aria-label="新建文件"
        title="新建 (⌘N)"
      >
        <FilePlus className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onOpenFile}
        aria-label="打开文件"
        title="打开 (⌘O)"
      >
        <FolderOpen className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onSaveFile}
        aria-label="保存文件"
        title="保存 (⌘S)"
      >
        <Save className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onExportHtml}
        aria-label="导出 HTML"
        title="导出 HTML (⌘⇧E)"
      >
        <FileText className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onExportPdf}
        aria-label="导出 PDF"
        title="导出 PDF (⌘⇧P)"
      >
        <Download className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onTogglePreviewVisible}
        aria-label={previewVisible ? '隐藏预览区' : '显示预览区'}
        title={previewVisible ? '隐藏预览区' : '显示预览区'}
      >
        {previewVisible ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onOpenSettings}
        aria-label="打开设置面板"
        title={`设置（当前：${themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '暗色' : '亮色'}）`}
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
        aria-label="粗体"
        title="粗体 (⌘B)"
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onItalic}
        aria-label="斜体"
        title="斜体 (⌘I)"
      >
        <Italic className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onCode}
        aria-label="行内代码"
        title="代码 (⌘`)"
      >
        <Code className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="no-drag-region size-7"
        onClick={onLink}
        aria-label="插入链接"
        title="链接 (⌘K)"
      >
        <Link className="size-3.5" />
      </Button>

      {/* 右侧：字数统计摘要 */}
      <div className="no-drag-region ml-auto">
        <span className="text-xs text-muted-foreground tabular-nums">
          {wordCount.words} 词 &middot; {wordCount.chars} 字符
        </span>
      </div>
    </div>
  )
}

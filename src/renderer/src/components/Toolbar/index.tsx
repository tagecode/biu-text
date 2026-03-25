import { FilePlus, FolderOpen, Save, Bold, Italic, Code, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type {
  EditorFontFamily,
  PreviewFontFamily,
  PreviewTheme
} from '@/hooks/useAppearanceSettings'
import type { Theme, ThemeMode } from '@/hooks/useTheme'
import type { WordCountResult } from '@/hooks/useWordCount'

interface ToolbarProps {
  theme: Theme
  themeMode: ThemeMode
  onNewFile: () => void
  onOpenFile: () => void
  onSaveFile: () => void
  onBold: () => void
  onItalic: () => void
  onCode: () => void
  onLink: () => void
  wordCount: WordCountResult
  editorFontFamily: EditorFontFamily
  previewFontFamily: PreviewFontFamily
  fontSize: number
  previewTheme: PreviewTheme
  onThemeModeChange: (value: ThemeMode) => void
  onEditorFontFamilyChange: (value: EditorFontFamily) => void
  onPreviewFontFamilyChange: (value: PreviewFontFamily) => void
  onFontSizeChange: (value: number) => void
  onPreviewThemeChange: (value: PreviewTheme) => void
}

// macOS hiddenInset 时红绿灯按钮宽度约 76px，需预留安全边距避免遮挡
const isMac = window.windowAPI?.platform === 'darwin'

export function Toolbar({
  themeMode,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onBold,
  onItalic,
  onCode,
  onLink,
  wordCount,
  editorFontFamily,
  previewFontFamily,
  fontSize,
  previewTheme,
  onThemeModeChange,
  onEditorFontFamilyChange,
  onPreviewFontFamilyChange,
  onFontSizeChange,
  onPreviewThemeChange
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

      <Separator orientation="vertical" className="h-4 mx-1.5" />

      <div className="no-drag-region flex items-center gap-1.5 ml-1">
        <ToolbarSelect
          ariaLabel="选择主题模式"
          title="主题模式"
          value={themeMode}
          onChange={(value) => onThemeModeChange(value as ThemeMode)}
          options={[
            ['light', '亮色'],
            ['dark', '暗色'],
            ['system', '跟随系统']
          ]}
        />
        <ToolbarSelect
          ariaLabel="选择编辑器字体"
          title="编辑器字体"
          value={editorFontFamily}
          onChange={(value) => onEditorFontFamilyChange(value as EditorFontFamily)}
          options={[
            ['jetbrains-mono', 'JetBrains Mono'],
            ['fira-code', 'Fira Code'],
            ['menlo', 'Menlo']
          ]}
        />
        <ToolbarSelect
          ariaLabel="选择预览字体"
          title="预览字体"
          value={previewFontFamily}
          onChange={(value) => onPreviewFontFamilyChange(value as PreviewFontFamily)}
          options={[
            ['sans', '预览: 无衬线'],
            ['serif', '预览: 衬线']
          ]}
        />
        <ToolbarSelect
          ariaLabel="选择预览主题"
          title="预览主题"
          value={previewTheme}
          onChange={(value) => onPreviewThemeChange(value as PreviewTheme)}
          options={[
            ['github', 'GitHub'],
            ['notion', 'Notion']
          ]}
        />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>字号</span>
          <input
            className="toolbar-range"
            aria-label="调整字号"
            type="range"
            min={12}
            max={24}
            step={1}
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
          />
          <span className="w-9 tabular-nums text-right">{fontSize}px</span>
        </label>
      </div>

      {/* 右侧：字数统计摘要 */}
      <div className="no-drag-region ml-auto">
        <span className="text-xs text-muted-foreground tabular-nums">
          {wordCount.words} 词 &middot; {wordCount.chars} 字符
        </span>
      </div>
    </div>
  )
}

function ToolbarSelect({
  ariaLabel,
  title,
  value,
  onChange,
  options
}: {
  ariaLabel: string
  title: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <select
      className="toolbar-select"
      aria-label={ariaLabel}
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  )
}

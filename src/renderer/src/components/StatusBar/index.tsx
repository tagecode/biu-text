import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PreviewTheme } from '@/hooks/useAppearanceSettings'
import type { Theme, ThemeMode } from '@/hooks/useTheme'
import type { WordCountResult } from '@/hooks/useWordCount'

interface StatusBarProps {
  line: number
  col: number
  wordCount: WordCountResult
  theme: Theme
  themeMode: ThemeMode
  previewTheme: PreviewTheme
  fontSize: number
  onCycleThemeMode: () => void
}

export function StatusBar({
  line,
  col,
  wordCount,
  theme,
  themeMode,
  previewTheme,
  fontSize,
  onCycleThemeMode
}: StatusBarProps) {
  const themeModeLabel =
    themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '暗色' : '亮色'

  return (
    <div
      className="flex items-center gap-0 px-3 h-[22px] shrink-0 border-t
        bg-muted/40 text-[11px] text-muted-foreground select-none"
    >
      {/* 光标位置 */}
      <StatusItem label={`行 ${line}, 列 ${col}`} />

      <Divider />

      {/* 字数统计 */}
      <StatusItem label={`${wordCount.words} 词`} />
      <Divider />
      <StatusItem label={`${wordCount.chars} 字符`} />
      <Divider />
      <StatusItem label={`${wordCount.lines} 行`} />

      {/* 右侧固定信息 */}
      <div className="ml-auto flex items-center gap-1">
        <StatusItem label="UTF-8" />
        <Divider />
        <StatusItem label={`${fontSize}px`} />
        <Divider />
        <StatusItem label={previewTheme === 'github' ? 'GitHub' : 'Notion'} />
        <Divider />
        <Button
          variant="ghost"
          size="icon"
          className="size-[18px] rounded-sm text-muted-foreground hover:text-foreground"
          onClick={onCycleThemeMode}
          aria-label="切换主题模式"
          title={`当前: ${themeModeLabel}`}
        >
          {themeMode === 'system' ? (
            <Monitor className="size-3" />
          ) : theme === 'dark' ? (
            <Sun className="size-3" />
          ) : (
            <Moon className="size-3" />
          )}
        </Button>
        <StatusItem label={themeModeLabel} />
      </div>
    </div>
  )
}

function StatusItem({ label }: { label: string }) {
  return (
    <span className="px-2 tabular-nums whitespace-nowrap hover:bg-muted/60 rounded transition-colors cursor-default py-0.5">
      {label}
    </span>
  )
}

function Divider() {
  return <span className="text-border/60 select-none">│</span>
}

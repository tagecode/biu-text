import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  FolderTree,
  PencilLine,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizePath } from '@shared/documents'
import { isValidFileName, type WorkspaceEntry } from '@shared/workspace'
import { cn } from '@/lib/utils'

export interface FileTreeProps {
  root: string | null
  entries: readonly WorkspaceEntry[]
  loading: boolean
  /** 当前活动文档的绝对路径，用于高亮 */
  activePath: string | null
  onOpenFile: (path: string) => void
  onOpenFolder: () => void
  onRefresh: () => void
  onCloseFolder: () => void
  onRename: (path: string, name: string) => Promise<boolean>
  onRemove: (path: string) => Promise<boolean>
}

interface ContextMenuState {
  x: number
  y: number
  entry: WorkspaceEntry
}

function baseName(path: string): string {
  const parts = normalizePath(path).split('/')
  return parts[parts.length - 1] || path
}

/**
 * 文件树侧边栏。
 *
 * 只负责展示与回调：目录遍历、重命名、删除都在主进程完成；
 * 删除确认也由主进程弹原生对话框（危险操作走系统对话框，与未保存确认一致）。
 */
export function FileTree({
  root,
  entries,
  loading,
  activePath,
  onOpenFile,
  onOpenFolder,
  onRefresh,
  onCloseFolder,
  onRename,
  onRemove
}: FileTreeProps) {
  const { t } = useTranslation()
  // 默认全部展开（树里只剩 Markdown，通常不深）；记住的是"被折叠"的目录
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [renaming, setRenaming] = useState<WorkspaceEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  // 打开对话框时选中"扩展名之前"的部分：改名通常只改主文件名。
  // 放到下一帧做——Radix 会在挂载后自己聚焦输入框，聚焦可能把选区挪到末尾。
  useEffect(() => {
    if (!renaming) return
    const frame = requestAnimationFrame(() => {
      const input = renameInputRef.current
      if (!input) return
      const dot = renaming.name.lastIndexOf('.')
      if (dot > 0) input.setSelectionRange(0, dot)
      else input.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [renaming])

  const renameInvalid = renameValue.trim() !== '' && !isValidFileName(renameValue.trim())

  // 右键菜单：点外面或按 Esc 关掉
  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  const toggleDirectory = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleContextMenu = useCallback((event: React.MouseEvent, entry: WorkspaceEntry) => {
    event.preventDefault()
    event.stopPropagation()
    // 贴边右键时把菜单夹回视口内，避免跑出窗口
    const menuWidth = 180
    const menuHeight = 84
    setMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
      entry
    })
  }, [])

  const startRename = useCallback((entry: WorkspaceEntry) => {
    setMenu(null)
    setRenaming(entry)
    setRenameValue(entry.name)
  }, [])

  const submitRename = useCallback(async () => {
    if (!renaming) return
    const name = renameValue.trim()
    if (!name || name === renaming.name) {
      setRenaming(null)
      return
    }
    const ok = await onRename(renaming.path, name)
    if (ok) setRenaming(null)
  }, [onRename, renameValue, renaming])

  const handleRemove = useCallback(
    async (entry: WorkspaceEntry) => {
      setMenu(null)
      await onRemove(entry.path)
    },
    [onRemove]
  )

  const activeNormalized = activePath ? normalizePath(activePath) : null

  const renderEntry = (entry: WorkspaceEntry, depth: number): React.ReactNode => {
    const isDirectory = entry.type === 'directory'
    const isOpen = !collapsed.has(entry.path)
    const isActive = !isDirectory && activeNormalized === normalizePath(entry.path)
    const Icon = isDirectory ? (isOpen ? FolderOpen : FolderTree) : FileText

    return (
      <li key={entry.path}>
        <div
          role="treeitem"
          aria-expanded={isDirectory ? isOpen : undefined}
          aria-selected={isActive}
          tabIndex={0}
          className={cn(
            'group flex cursor-pointer items-center gap-1 rounded px-1.5 py-[3px] text-xs',
            isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          onClick={() => (isDirectory ? toggleDirectory(entry.path) : onOpenFile(entry.path))}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            if (isDirectory) toggleDirectory(entry.path)
            else onOpenFile(entry.path)
          }}
          onContextMenu={(event) => handleContextMenu(event, entry)}
          title={entry.path}
        >
          {isDirectory ? (
            isOpen ? (
              <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
            )
          ) : (
            <span className="size-3 shrink-0" />
          )}
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{entry.name}</span>
        </div>
        {isDirectory && isOpen && entry.children && entry.children.length > 0 && (
          <ul role="group">{entry.children.map((child) => renderEntry(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <aside
      aria-label={t('workspace.title')}
      className="flex h-full w-full flex-col border-r bg-muted/20"
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b px-2">
        <FolderTree className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium" title={root ?? undefined}>
          {root ? baseName(root) : t('workspace.title')}
        </span>
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={t('workspace.refresh')}
            disabled={!root || loading}
            onClick={onRefresh}
          >
            <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
          </Button>
          {root && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={t('workspace.closeFolder')}
              onClick={onCloseFolder}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {root === null ? (
          <div className="flex flex-col items-start gap-2 px-3 py-3">
            <p className="text-xs text-muted-foreground">{t('workspace.empty')}</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onOpenFolder}>
              <FolderOpen className="mr-1 size-3" />
              {t('workspace.openFolder')}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              {t('workspace.openFolderHint')}
            </p>
          </div>
        ) : entries.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">{t('workspace.openFolderHint')}</p>
        ) : (
          <ul role="tree" className="px-1">
            {entries.map((entry) => renderEntry(entry, 0))}
          </ul>
        )}
      </div>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-1 text-xs shadow-md"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
            onClick={() => startRename(menu.entry)}
          >
            <PencilLine className="size-3" />
            {t('workspace.rename')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-destructive hover:bg-accent"
            onClick={() => void handleRemove(menu.entry)}
          >
            <Trash2 className="size-3" />
            {t('workspace.delete')}
          </button>
        </div>
      )}

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
      >
        {/* 与设置面板同一套骨架：gap-0 + p-0，由内部区块自己给内边距 */}
        <DialogContent className="max-w-sm gap-0 overflow-hidden p-0 sm:max-w-sm" aria-describedby={undefined}>
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <DialogTitle className="min-w-0 truncate">
              {t('workspace.renameTitle', { name: renaming?.name ?? '' })}
            </DialogTitle>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={t('workspace.closeDialog')}
              >
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
          <form
            className="flex flex-col gap-3 px-4 py-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submitRename()
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="workspace-rename-input" className="text-xs text-muted-foreground">
                {t('workspace.renameLabel')}
              </Label>
              <Input
                id="workspace-rename-input"
                ref={renameInputRef}
                value={renameValue}
                aria-invalid={renameInvalid || undefined}
                onChange={(event) => setRenameValue(event.target.value)}
              />
              {renameInvalid && (
                <p className="text-[11px] text-destructive">{t('workspace.renameInvalid')}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                {t('workspace.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={renameInvalid || renameValue.trim() === ''}>
                {t('workspace.renameConfirm')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  )
}

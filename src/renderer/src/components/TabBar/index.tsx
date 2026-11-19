import { useState, type DragEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { documentLabel, isDocumentDirty, type TabDocument } from '@shared/documents'
import { cn } from '@/lib/utils'

export interface TabBarProps {
  documents: readonly TabDocument[]
  activeId: string
  onActivate: (docId: string) => void
  onClose: (docId: string) => void
  onNew: () => void
  /** 把 docId 插到移动前数组的 insertIndex 位置（0..length） */
  onMove: (docId: string, insertIndex: number) => void
}

/**
 * 标签栏只负责展示与回调：脏标记、标签名、活动态都由文档集合派生，
 * 关闭标签涉及的「保存 / 不保存 / 取消」由上层走主进程对话框。
 *
 * 拖拽排序用原生 HTML5 DnD：拖动只改变文档数组顺序，编辑器实例由 doc.id 保持挂载。
 */
export function TabBar({ documents, activeId, onActivate, onClose, onNew, onMove }: TabBarProps) {
  const { t } = useTranslation()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const endDrag = (): void => {
    setDraggingId(null)
    setDropIndex(null)
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>, docId: string): void => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', docId)
    setDraggingId(docId)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number, docId: string): void => {
    if (!draggingId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    // 拖到自己身上时保留原落点，否则「拖到右半边自己」会被算成向后挪一格
    if (docId === draggingId) return
    const rect = event.currentTarget.getBoundingClientRect()
    setDropIndex(event.clientX < rect.left + rect.width / 2 ? index : index + 1)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (draggingId && dropIndex !== null) onMove(draggingId, dropIndex)
    endDrag()
  }

  return (
    <div
      role="tablist"
      aria-label={t('tabs.list')}
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-muted/40 select-none"
      onDragEnd={endDrag}
      onDrop={handleDrop}
    >
      {documents.map((doc, index) => {
        const active = doc.id === activeId
        const label = documentLabel(doc, t('app.untitled'))
        const dirty = isDocumentDirty(doc)
        const dragging = doc.id === draggingId
        const dropBefore = dropIndex === index
        const dropAfter = dropIndex === documents.length && index === documents.length - 1
        return (
          <div
            key={doc.id}
            draggable
            data-testid={`tab-${doc.id}`}
            onDragStart={(event) => handleDragStart(event, doc.id)}
            onDragOver={(event) => handleDragOver(event, index, doc.id)}
            className={cn(
              'group relative flex min-w-0 shrink-0 items-center border-r',
              active ? 'bg-background' : 'hover:bg-muted/70',
              dragging && 'opacity-50'
            )}
          >
            {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
            {dropBefore && (
              <span
                aria-hidden
                data-testid="tab-drop-indicator"
                className="absolute inset-y-0 left-0 z-10 w-0.5 -translate-x-1/2 bg-primary"
              />
            )}
            {dropAfter && (
              <span
                aria-hidden
                data-testid="tab-drop-indicator"
                className="absolute inset-y-0 right-0 z-10 w-0.5 translate-x-1/2 bg-primary"
              />
            )}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={doc.filePath ?? label}
              onClick={() => onActivate(doc.id)}
              className="flex h-full min-w-0 max-w-[200px] cursor-grab items-center gap-1.5 pl-3 pr-1 text-xs active:cursor-grabbing"
            >
              <span className="truncate">{label}</span>
              {dirty && (
                <span
                  data-testid="tab-dirty"
                  aria-label={t('tabs.unsaved')}
                  className="size-1.5 shrink-0 rounded-full bg-amber-500"
                />
              )}
            </button>
            <button
              type="button"
              aria-label={t('tabs.close', { name: label })}
              draggable={false}
              onClick={() => onClose(doc.id)}
              className="mr-1 grid size-4 shrink-0 place-items-center rounded text-muted-foreground/60 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
      <button
        type="button"
        aria-label={t('tabs.new')}
        onClick={onNew}
        className="my-1 ml-1 grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

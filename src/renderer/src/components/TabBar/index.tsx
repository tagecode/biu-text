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
}

/**
 * 标签栏只负责展示与回调：脏标记、标签名、活动态都由文档集合派生，
 * 关闭标签涉及的「保存 / 不保存 / 取消」由上层走主进程对话框。
 */
export function TabBar({ documents, activeId, onActivate, onClose, onNew }: TabBarProps) {
  const { t } = useTranslation()

  return (
    <div
      role="tablist"
      aria-label={t('tabs.list')}
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-muted/40 select-none"
    >
      {documents.map((doc) => {
        const active = doc.id === activeId
        const label = documentLabel(doc, t('app.untitled'))
        const dirty = isDocumentDirty(doc)
        return (
          <div
            key={doc.id}
            className={cn(
              'group relative flex min-w-0 shrink-0 items-center border-r',
              active ? 'bg-background' : 'hover:bg-muted/70'
            )}
          >
            {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={doc.filePath ?? label}
              onClick={() => onActivate(doc.id)}
              className="flex h-full min-w-0 max-w-[200px] items-center gap-1.5 pl-3 pr-1 text-xs"
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

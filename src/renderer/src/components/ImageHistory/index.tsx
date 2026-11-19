import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageOff, MoreHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast-store'
import type { ImageHistoryEntry } from '@shared/image-history'

interface ImageHistoryDialogProps {
  open: boolean
  onClose: () => void
}

function markdownFor(entry: ImageHistoryEntry): string {
  const alt = entry.fileName.replace(/[[\]]/g, '')
  return `![${alt}](${entry.url})`
}

export function ImageHistoryDialog({ open, onClose }: ImageHistoryDialogProps) {
  const { t, i18n } = useTranslation()
  const [entries, setEntries] = useState<ImageHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }),
    [i18n.language]
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async (): Promise<void> => {
      // 让出一次微任务：避免在 effect 体内同步 setState 触发级联渲染
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      try {
        const list = await window.imageAPI.getHistory()
        if (!cancelled) setEntries(list)
      } catch {
        if (!cancelled) toast({ level: 'error', title: t('imageHistory.loadFailed') })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, t])

  const copy = (text: string): void => {
    window.windowAPI.writeClipboard(text)
    toast({ level: 'success', title: t('imageHistory.copied') })
  }

  const remove = async (entry: ImageHistoryEntry): Promise<void> => {
    try {
      setEntries(await window.imageAPI.removeHistory(entry.id))
    } catch {
      toast({ level: 'error', title: t('imageHistory.deleteFailed') })
    }
  }

  // 菜单由主进程弹原生菜单：对话框的焦点锁会 aria-hidden 掉自绘浮层
  const handleMenu = async (entry: ImageHistoryEntry): Promise<void> => {
    const action = await window.imageAPI.showHistoryMenu()
    if (action === 'url') copy(entry.url)
    else if (action === 'markdown') copy(markdownFor(entry))
    else if (action === 'delete') await remove(entry)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <DialogTitle>{t('imageHistory.title')}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label={t('imageHistory.close')}>
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('imageHistory.loading')}</p>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <ImageOff className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">{t('imageHistory.empty')}</p>
              <p className="max-w-sm text-xs text-muted-foreground">{t('imageHistory.emptyHint')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  data-testid={`image-history-${entry.id}`}
                  className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/60"
                  onContextMenu={(event) => {
                    event.preventDefault()
                    void handleMenu(entry)
                  }}
                >
                  <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                    <ImageOff className="size-4 text-muted-foreground" />
                    <img
                      src={entry.url}
                      alt={entry.fileName}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                      onError={(event) => {
                        event.currentTarget.hidden = true
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={entry.fileName}>
                      {entry.fileName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={entry.url}>
                      {entry.url}
                    </p>
                  </div>

                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={new Date(entry.uploadedAt).toISOString()}
                  >
                    {formatter.format(entry.uploadedAt)}
                  </time>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={t('imageHistory.actions')}
                    onClick={() => void handleMenu(entry)}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

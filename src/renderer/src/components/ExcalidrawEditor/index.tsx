import { Suspense, lazy, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { buildExcalidrawBlock, compactAppState } from '@shared/excalidraw'
import type { Theme } from '@/hooks/useTheme'
import type { ExcalidrawSceneSnapshot } from './Canvas'

// 编辑器的 1.7MB 依赖与样式只在打开对话框时才下载
const ExcalidrawCanvas = lazy(() => import('./Canvas'))

export interface ExcalidrawEditorProps {
  open: boolean
  theme: Theme
  onClose: () => void
  /** 插入时把生成的 ```excalidraw 代码块交给调用方写到光标处 */
  onInsert: (block: string) => void
}

/**
 * 「插入手绘图」对话框。
 *
 * 画布内容以 `.excalidraw` 同构的 JSON 存进文档，所以：
 * - 本应用可以直接渲染成 SVG；
 * - 用户也能把这段 JSON 拖进 excalidraw.com 继续编辑（保留可编辑性）。
 */
export function ExcalidrawEditor({ open, theme, onClose, onInsert }: ExcalidrawEditorProps) {
  const { t } = useTranslation()
  const sceneRef = useRef<ExcalidrawSceneSnapshot | null>(null)
  const [hasContent, setHasContent] = useState(false)

  const handleChange = useCallback((snapshot: ExcalidrawSceneSnapshot) => {
    sceneRef.current = snapshot
    const count = snapshot.elements.filter(
      (element) => !(element as { isDeleted?: boolean }).isDeleted
    ).length
    // 只在"空 ↔ 非空"之间切换状态，避免每画一笔都重渲染整个对话框
    const next = count > 0
    setHasContent((prev) => (prev === next ? prev : next))
  }, [])

  const handleInsert = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    const elements = scene.elements.filter(
      (element) => !(element as { isDeleted?: boolean }).isDeleted
    )
    if (elements.length === 0) return
    onInsert(
      buildExcalidrawBlock({
        elements,
        appState: compactAppState(scene.appState),
        files: scene.files
      })
    )
    onClose()
  }, [onClose, onInsert])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        className="flex h-[72vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        aria-describedby={undefined}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <DialogTitle className="min-w-0 truncate">{t('excalidraw.title')}</DialogTitle>
          <p className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:block">
            {t('excalidraw.hint')}
          </p>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={t('excalidraw.close')}
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        <div className="relative min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                {t('excalidraw.loading')}
              </div>
            }
          >
            {/* 只在打开时挂载：关闭后不保留画布与事件监听 */}
            {open && <ExcalidrawCanvas theme={theme} onChange={handleChange} />}
          </Suspense>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {hasContent ? '' : t('excalidraw.empty')}
          </span>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('excalidraw.cancel')}
            </Button>
            <Button type="button" size="sm" disabled={!hasContent} onClick={handleInsert}>
              {t('excalidraw.insert')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

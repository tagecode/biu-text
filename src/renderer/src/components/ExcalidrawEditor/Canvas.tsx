import { useCallback } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { Theme } from '@/hooks/useTheme'

export interface ExcalidrawSceneSnapshot {
  elements: readonly unknown[]
  appState: Record<string, unknown>
  files: Record<string, unknown> | null
}

interface ExcalidrawCanvasProps {
  theme: Theme
  /** 画布每变一次就回调一次，调用方自己决定怎么存 */
  onChange: (snapshot: ExcalidrawSceneSnapshot) => void
}

/**
 * 真正引入 `@excalidraw/excalidraw` 的模块（含它的样式）。
 *
 * 单独立成一个文件，由 `ExcalidrawEditor` 通过 `lazy()` 加载：
 * 这个包有 1.7MB 量级，绝不能进主包。
 */
export default function ExcalidrawCanvas({ theme, onChange }: ExcalidrawCanvasProps) {
  const handleChange = useCallback(
    (elements: readonly never[], appState: never, files: never) => {
      onChange({
        elements,
        appState: appState as unknown as Record<string, unknown>,
        files: (files ?? null) as Record<string, unknown> | null
      })
    },
    [onChange]
  )

  return (
    <Excalidraw
      theme={theme}
      // initialData 的类型由 Excalidraw 内部导出，这里只用到背景色
      initialData={
        {
          appState: {
            viewBackgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff'
          }
        } as never
      }
      onChange={handleChange as never}
      UIOptions={{
        canvasActions: {
          loadScene: false,
          saveToActiveFile: false,
          export: false,
          saveAsImage: false
        }
      }}
    />
  )
}

import DOMPurify from 'dompurify'
import i18n from '@/i18n'
import { diagramCacheKey, type DiagramBlock } from '@shared/diagram'
import { parseExcalidrawScene } from '@shared/excalidraw'
import type { Theme } from '@/hooks/useTheme'

const SVG_CACHE_LIMIT = 60
const svgCache = new Map<string, string>()

type ExcalidrawModule = typeof import('@excalidraw/excalidraw')

let excalidrawPromise: Promise<ExcalidrawModule> | null = null
let renderQueue: Promise<unknown> = Promise.resolve()

/**
 * 懒加载整个 Excalidraw。
 *
 * 它只有遇到 `excalidraw` 代码块（或打开手绘图编辑器）时才下载，
 * 因此不含手绘图的文档完全不受影响。
 */
function loadExcalidraw(): Promise<ExcalidrawModule> {
  excalidrawPromise ??= import('@excalidraw/excalidraw')
  return excalidrawPromise
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(task, task)
  renderQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function remember(key: string, svg: string): void {
  if (svgCache.size >= SVG_CACHE_LIMIT) {
    const oldest = svgCache.keys().next().value
    if (oldest !== undefined) svgCache.delete(oldest)
  }
  svgCache.set(key, svg)
}

function sanitizeSvg(svg: string): string {
  const clean = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
  if (!clean.includes('<svg')) throw new Error('Excalidraw did not return SVG')
  return clean
}

function parseError(error: string): Error {
  if (error === 'invalidJson') return new Error(i18n.t('diagram.invalidJson'))
  if (error === 'missingElements') return new Error(i18n.t('excalidraw.missingScene'))
  return new Error(i18n.t('excalidraw.emptyScene'))
}

/**
 * 把手绘场景渲染成 SVG 字符串。
 *
 * 与 Graphviz 一样：渲染结果按 `lang + theme + code` 缓存，导出的 HTML/PDF 直接内联这份 SVG。
 */
export async function renderExcalidrawSvg(block: DiagramBlock, theme: Theme): Promise<string> {
  const key = diagramCacheKey(block, theme)
  const cached = svgCache.get(key)
  if (cached) return cached

  return enqueue(async () => {
    const hit = svgCache.get(key)
    if (hit) return hit

    const parsed = parseExcalidrawScene(block.code)
    if (!parsed.ok) throw parseError(parsed.error)

    const { exportToSvg } = await loadExcalidraw()
    const dark = theme === 'dark'
    const svgElement = await exportToSvg({
      elements: parsed.scene.elements as never,
      appState: {
        ...parsed.scene.appState,
        exportBackground: parsed.scene.appState.exportBackground ?? true,
        viewBackgroundColor:
          (parsed.scene.appState.viewBackgroundColor as string | undefined) ??
          (dark ? '#1e1e1e' : '#ffffff'),
        exportWithDarkMode: dark
      },
      files: (parsed.scene.files ?? null) as never,
      exportPadding: 12,
      // 外链图片/网页嵌入在导出里不渲染，避免离线环境挂住
      renderEmbeddables: false,
      // 不把字体文件内联进 SVG：那会去 CDN 拉字体，离线/CSP 下必然失败；
      // 代价是文字用系统字体回退，形状与布局不受影响
      skipInliningFonts: true
    })

    const svg = sanitizeSvg(svgElement.outerHTML)
    remember(key, svg)
    return svg
  })
}

/** 只用于测试：清空缓存 */
export function resetExcalidrawCache(): void {
  svgCache.clear()
}

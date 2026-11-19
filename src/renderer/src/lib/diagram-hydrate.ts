import DOMPurify from 'dompurify'
import { renderChartDiagram } from '@/lib/chart-render'
import { renderGraphvizSvg } from '@/lib/graphviz-render'
import { renderExcalidrawSvg } from '@/lib/excalidraw-render'
import i18n from '@/i18n'
import { diagramCacheKey, type DiagramBlock } from '@shared/diagram'
import type { Theme } from '@/hooks/useTheme'

const SVG_CACHE_LIMIT = 60
const svgCache = new Map<string, string>()

interface MermaidApi {
  initialize(config: Record<string, unknown>): void
  render(id: string, code: string): Promise<{ svg: string }>
}

let mermaidPromise: Promise<MermaidApi> | null = null
let mermaidTheme: Theme | null = null
let renderQueue: Promise<unknown> = Promise.resolve()
let renderSeq = 0

async function getMermaid(theme: Theme): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((mod) => (mod.default ?? mod) as unknown as MermaidApi)
  const mermaid = await mermaidPromise
  if (mermaidTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'inherit',
      // 默认的 htmlLabels 把文字塞进 <foreignObject> 里的 XHTML，会被只放行 SVG 的
      // DOMPurify 配置整块剥掉，节点变成空框；改成纯 <text> 既保得住也够用
      htmlLabels: false,
      flowchart: { htmlLabels: false }
    })
    mermaidTheme = theme
  }
  return mermaid
}

// mermaid 内部会创建临时 DOM 节点，并发调用会互相污染，这里串行化
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(task, task)
  renderQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })
}

function rememberSvg(key: string, svg: string): void {
  if (svgCache.size >= SVG_CACHE_LIMIT) {
    const oldest = svgCache.keys().next().value
    if (oldest !== undefined) svgCache.delete(oldest)
  }
  svgCache.set(key, svg)
}

/** 预览区和编辑区内联预览共用同一条串行队列与缓存。 */
export async function renderDiagramSvg(block: DiagramBlock, theme: Theme): Promise<string> {
  const key = diagramCacheKey(block, theme)
  const cached = svgCache.get(key)
  if (cached) return cached
  return enqueue(async () => {
    const hit = svgCache.get(key)
    if (hit) return hit
    const mermaid = await getMermaid(theme)
    const result = await mermaid.render(`biu-diagram-${++renderSeq}`, block.code)
    const svg = sanitizeSvg(result.svg)
    rememberSvg(key, svg)
    return svg
  })
}

function showSource(host: HTMLElement, block: DiagramBlock): void {
  const pre = document.createElement('pre')
  pre.className = 'biu-diagram-source'
  const code = document.createElement('code')
  code.textContent = block.code
  pre.append(code)
  host.replaceChildren(pre)
  host.dataset.diagramState = 'pending'
}

function mountSvg(host: HTMLElement, svg: string): void {
  const wrap = document.createElement('div')
  wrap.className = 'biu-diagram-svg'
  wrap.innerHTML = svg
  host.replaceChildren(wrap)
  host.dataset.diagramState = 'ready'
}

function mountError(host: HTMLElement, error: unknown): void {
  const box = document.createElement('div')
  box.className = 'biu-diagram-error'
  box.textContent = i18n.t('diagram.renderFailed')
  const detail = document.createElement('code')
  detail.textContent = error instanceof Error ? error.message : String(error)
  box.append(detail)
  host.append(box)
  host.dataset.diagramState = 'error'
}

export interface HydrateDiagramsOptions {
  theme: Theme
  signal: AbortSignal
  /** 导出时把 Canvas 收成图片，预览区保持可悬停的图表 */
  rasterize?: boolean
}

/**
 * 把占位块水合为图表。
 *
 * 预览区按块增量更新 DOM，所以现在**按块**调用：只水合本次被重建的块，
 * 其它块里已经画好的 SVG 原样留着。abort 用于块被替换/移除、
 * 或主题与语言变化时取消在途渲染。
 */
export async function hydrateDiagrams(
  root: ParentNode,
  blocks: DiagramBlock[],
  { theme, signal, rasterize = false }: HydrateDiagramsOptions
): Promise<void> {
  for (const block of blocks) {
    if (signal.aborted) return
    const host = root.querySelector<HTMLElement>(`[data-diagram-id="${block.id}"]`)
    if (!host) continue
    showSource(host, block)

    try {
      const renderer = getDiagramRenderer(block.lang)
      if (!renderer) throw new Error(i18n.t('diagram.unsupportedType'))
      await renderer(host, block, theme, signal, rasterize)
      if (signal.aborted) return
    } catch (error) {
      if (signal.aborted) return
      showSource(host, block)
      mountError(host, error)
    }
  }
}

export type DiagramRenderer = (
  host: HTMLElement,
  block: DiagramBlock,
  theme: Theme,
  signal: AbortSignal,
  rasterize: boolean
) => Promise<void>

const diagramRenderers = new Map<string, DiagramRenderer>()

/**
 * 注册自定义图表渲染器。
 *
 * 内置的 mermaid/chartjs/dot/excalidraw 也在启动时走这里；
 * 插件只需调用本函数（并确保 `registerDiagramLanguage` 已登记语言）。
 */
export function registerDiagramRenderer(lang: string, renderer: DiagramRenderer): void {
  const normalized = lang.trim().toLowerCase()
  if (!normalized) return
  diagramRenderers.set(normalized, renderer)
}

export function getDiagramRenderer(lang: string): DiagramRenderer | undefined {
  return diagramRenderers.get(lang.trim().toLowerCase())
}

export function listDiagramRenderers(): string[] {
  return Array.from(diagramRenderers.keys())
}

registerDiagramRenderer('mermaid', async (host, block, theme, signal) => {
  const svg = await renderDiagramSvg(block, theme)
  if (signal.aborted) return
  mountSvg(host, svg)
})
registerDiagramRenderer('chartjs', renderChartDiagram)
registerDiagramRenderer('dot', async (host, block, theme, signal) => {
  const svg = await renderGraphvizSvg(block, theme)
  if (signal.aborted) return
  mountSvg(host, svg)
})
registerDiagramRenderer('excalidraw', async (host, block, theme, signal) => {
  const svg = await renderExcalidrawSvg(block, theme)
  if (signal.aborted) return
  mountSvg(host, svg)
})

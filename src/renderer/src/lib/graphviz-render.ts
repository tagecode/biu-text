import DOMPurify from 'dompurify'
import { diagramCacheKey, type DiagramBlock } from '@shared/diagram'
import type { Theme } from '@/hooks/useTheme'

const SVG_CACHE_LIMIT = 60
const svgCache = new Map<string, string>()

interface VizApi {
  renderString(
    source: string,
    options: {
      format: 'svg'
      engine: 'dot'
      graphAttributes: Record<string, string>
      nodeAttributes: Record<string, string>
      edgeAttributes: Record<string, string>
    }
  ): string
}

let vizPromise: Promise<VizApi> | null = null
let renderQueue: Promise<unknown> = Promise.resolve()

function loadViz(): Promise<VizApi> {
  vizPromise ??= import('@viz-js/viz').then((mod) => mod.instance())
  return vizPromise
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
  const start = svg.indexOf('<svg')
  if (start < 0) throw new Error('Graphviz did not return SVG')
  const clean = DOMPurify.sanitize(svg.slice(start), { USE_PROFILES: { svg: true, svgFilters: true } })
  if (!clean.includes('<svg')) throw new Error('Graphviz did not return SVG')
  return clean
}

/** 预览和导出都要内联 SVG。只接受 SVG，布局引擎固定为 dot。 */
export async function renderGraphvizSvg(block: DiagramBlock, theme: Theme): Promise<string> {
  const key = diagramCacheKey(block, theme)
  const cached = svgCache.get(key)
  if (cached) return cached
  return enqueue(async () => {
    const hit = svgCache.get(key)
    if (hit) return hit
    const viz = await loadViz()
    const ink = theme === 'dark' ? '#e5e7eb' : '#24292f'
    const svg = sanitizeSvg(
      viz.renderString(block.code, {
        format: 'svg',
        engine: 'dot',
        graphAttributes: { bgcolor: 'transparent', fontcolor: ink },
        nodeAttributes: { color: ink, fontcolor: ink },
        edgeAttributes: { color: ink, fontcolor: ink }
      })
    )
    remember(key, svg)
    return svg
  })
}

/** 预览区需要异步渲染的图表块；markdown-it fence 规则收集，水合阶段消费 */
export interface DiagramBlock {
  /** 同一次渲染内唯一，对应占位元素的 data-diagram-id */
  id: string
  lang: string
  code: string
}

/** 缓存键包含语言、主题与源码：主题切换或源码改动都会自然失配 */
export function diagramCacheKey(block: DiagramBlock, theme: 'light' | 'dark'): string {
  return `${block.lang} ${theme} ${block.code}`
}

/** 工具栏「插入 Mermaid」插入的脚手架：能直接渲染出图，用户在此基础上改 */
export const MERMAID_SNIPPET = '```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```'

const DIAGRAM_LANGS = new Set(['mermaid', 'chartjs', 'dot'])

/** 预览区会水合的围栏语言。新增一种图表时在这里登记，并提供对应渲染器。 */
export function isDiagramLang(lang: string): boolean {
  return DIAGRAM_LANGS.has(lang)
}

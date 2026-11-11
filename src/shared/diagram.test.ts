import { describe, expect, it } from 'vitest'
import { diagramCacheKey, isDiagramLang, type DiagramBlock } from './diagram'

const block: DiagramBlock = { id: 'd0', lang: 'mermaid', code: 'graph TD; A-->B' }

describe('diagramCacheKey', () => {
  it('is stable for the same block and theme', () => {
    expect(diagramCacheKey(block, 'light')).toBe(diagramCacheKey({ ...block }, 'light'))
  })

  it('separates themes', () => {
    expect(diagramCacheKey(block, 'light')).not.toBe(diagramCacheKey(block, 'dark'))
  })

  it('separates sources and languages', () => {
    expect(diagramCacheKey(block, 'light')).not.toBe(
      diagramCacheKey({ ...block, code: 'graph TD; A-->C' }, 'light')
    )
    expect(diagramCacheKey(block, 'light')).not.toBe(
      diagramCacheKey({ ...block, lang: 'dot' }, 'light')
    )
  })

  it('ignores the block id so identical diagrams share one cache entry', () => {
    expect(diagramCacheKey({ ...block, id: 'd7' }, 'light')).toBe(diagramCacheKey(block, 'light'))
  })
})

describe('isDiagramLang', () => {
  it('accepts the diagram fences the preview can hydrate', () => {
    expect(isDiagramLang('mermaid')).toBe(true)
    expect(isDiagramLang('chartjs')).toBe(true)
    expect(isDiagramLang('javascript')).toBe(false)
    expect(isDiagramLang('')).toBe(false)
  })
})

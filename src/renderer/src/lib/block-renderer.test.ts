/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import { describe, expect, it } from 'vitest'
import { BlockRenderer } from './block-renderer'

const DOC = 'C:/notes/a.md'

function texts(renderer: BlockRenderer, content: string, documentPath: string | null = DOC) {
  const result = renderer.render(content, {
    resolveImageSrc: (src) => `biu-image://local/?path=${encodeURIComponent(src)}`,
    documentPath
  })
  return result
}

describe('BlockRenderer', () => {
  it('内容没变时命中缓存，不产生变更块', () => {
    const renderer = new BlockRenderer()
    const first = texts(renderer, '# 标题\n\n段落一\n\n段落二')
    expect(first.changedKeys).toHaveLength(first.blocks.length)

    const second = texts(renderer, '# 标题\n\n段落一\n\n段落二')
    expect(second.changedKeys).toEqual([])
    expect(second.blocks.map((b) => b.html)).toEqual(first.blocks.map((b) => b.html))
  })

  it('只改动一块时只有那一块被标记为变化', () => {
    const renderer = new BlockRenderer()
    const first = texts(renderer, '# 标题\n\n段落一\n\n段落二')
    const second = texts(renderer, '# 标题\n\n段落一改过了\n\n段落二')

    expect(second.changedKeys).toHaveLength(1)
    const unchangedHtml = new Map(first.blocks.map((b) => [b.key, b.html]))
    for (const block of second.blocks) {
      if (unchangedHtml.has(block.key)) {
        expect(block.html).toBe(unchangedHtml.get(block.key))
      }
    }
  })

  it('新增段落只渲染新块', () => {
    const renderer = new BlockRenderer()
    texts(renderer, '段落一\n\n段落二')
    const second = texts(renderer, '段落一\n\n段落二\n\n段落三')
    expect(second.blocks).toHaveLength(3)
    expect(second.changedKeys).toHaveLength(1)
    expect(second.changedKeys[0]).toBe(second.blocks[2].key)
  })

  it('换文档路径会让所有块失效（图片地址改写不同）', () => {
    const renderer = new BlockRenderer()
    texts(renderer, '段落一\n\n段落二', 'C:/notes/a.md')
    const other = texts(renderer, '段落一\n\n段落二', 'C:/notes/b.md')
    expect(other.changedKeys).toHaveLength(2)
  })

  it('输出经过消毒', () => {
    const renderer = new BlockRenderer()
    const result = texts(renderer, '<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>')
    const html = result.blocks.map((b) => b.html).join('')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
  })

  it('相对图片按文档路径改写', () => {
    const renderer = new BlockRenderer()
    const result = texts(renderer, '![a](assets/a.png)')
    expect(result.blocks[0].html).toContain('biu-image://')
  })

  it('跨块的图表占位 id 不重复', () => {
    const renderer = new BlockRenderer()
    const result = texts(renderer, '```mermaid\ngraph TD\nA-->B\n```\n\n```mermaid\ngraph TD\nC-->D\n```')
    const ids = result.blocks.flatMap((block) => block.diagrams.map((diagram) => diagram.id))
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    // HTML 里的 data-diagram-id 必须与收集到的 id 一致
    for (const block of result.blocks) {
      for (const diagram of block.diagrams) {
        expect(block.html).toContain(`data-diagram-id="${diagram.id}"`)
      }
    }
  })

  it('不可分段的文档走整篇渲染，只有一块', () => {
    const renderer = new BlockRenderer()
    const result = texts(renderer, '[foo]: /url\n\n段落一\n\n段落二')
    expect(result.segmented).toBe(false)
    expect(result.blocks).toHaveLength(1)
  })

  it('预算用尽时返回 done=false，后续调用接着渲染', () => {
    const total = 200
    const doc = Array.from({ length: total }, (_, index) => `段落 ${index}`).join('\n\n')
    const baseline = texts(new BlockRenderer(), doc)
    const expectedKeys = baseline.blocks.map((block) => block.key)
    const expectedHtml = baseline.blocks.map((block) => block.html)

    const renderer = new BlockRenderer()
    const first = renderer.render(doc, { documentPath: DOC }, 0)
    expect(first.done).toBe(false)
    // 消毒是按批进行的，所以每次至少推进一批，但不会一口气渲染完
    expect(first.blocks.length).toBeGreaterThan(1)
    expect(first.blocks.length).toBeLessThan(total)

    let result = first
    let calls = 1
    while (!result.done && calls < 200) {
      result = renderer.render(doc, { documentPath: DOC }, 0)
      calls++
    }

    expect(result.done).toBe(true)
    expect(calls).toBeGreaterThan(1)
    expect(calls).toBeLessThan(total)
    expect(result.blocks.map((block) => block.key)).toEqual(expectedKeys)
    expect(result.blocks.map((block) => block.html)).toEqual(expectedHtml)
    // 整个 generation 期间返回同一个数组实例，调用方据此判断"只是追加"
    expect(result.blocks).toBe(first.blocks)
  })

  it('分帧渲染期间内容变化会重新开始', () => {
    const first = Array.from({ length: 200 }, (_, index) => `旧段落 ${index}`).join('\n\n')
    const renderer = new BlockRenderer()
    const partial = renderer.render(first, { documentPath: DOC }, 0)
    expect(partial.done).toBe(false)

    const second = Array.from({ length: 40 }, (_, index) => `新段落 ${index}`).join('\n\n')
    const restarted = renderer.render(second, { documentPath: DOC }, 0)
    expect(restarted.blocks).not.toBe(partial.blocks)
    expect(restarted.blocks[0].html).toContain('新段落 0')
  })
})

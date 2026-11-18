/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import { describe, expect, it } from 'vitest'
import { applyBlocks, appendBlocks } from './preview-dom'
import type { RenderedBlock } from './block-renderer'

function block(key: string, html: string, diagrams: RenderedBlock['diagrams'] = []): RenderedBlock {
  return { key, html, diagrams }
}

function apply(
  article: HTMLElement,
  blocks: RenderedBlock[],
  changed: string[] = blocks.map((item) => item.key)
) {
  return applyBlocks(article, blocks, new Set(changed))
}

function firstElement(article: HTMLElement, tag: string): Element {
  const element = article.querySelector(tag)
  if (!element) throw new Error(`missing ${tag}`)
  return element
}

describe('applyBlocks', () => {
  it('首次写入把每块都插进去，并带锚点注释', () => {
    const article = document.createElement('article')
    const result = apply(article, [block('a', '<p>一</p>'), block('b', '<p>二</p>')])

    expect(result.rebuiltKeys).toEqual(['a', 'b'])
    expect(article.querySelectorAll('p')).toHaveLength(2)
    expect(article.textContent).toBe('一二')
  })

  it('只替换变化的那一块，其它块的 DOM 节点保持同一个', () => {
    const article = document.createElement('article')
    apply(article, [block('a', '<p>一</p>'), block('b', '<p>二</p>'), block('c', '<p>三</p>')])

    const before = Array.from(article.querySelectorAll('p'))
    const result = apply(
      article,
      [block('a', '<p>一</p>'), block('b', '<p>二改</p>'), block('c', '<p>三</p>')],
      ['b']
    )

    const after = Array.from(article.querySelectorAll('p'))
    expect(result.rebuiltKeys).toEqual(['b'])
    expect(article.textContent).toBe('一二改三')
    // 未变化的块必须是同一批节点（没有被重建）
    expect(after[0]).toBe(before[0])
    expect(after[2]).toBe(before[2])
    expect(after[1]).not.toBe(before[1])
  })

  it('删除块时连带锚点一起移除', () => {
    const article = document.createElement('article')
    apply(article, [block('a', '<p>一</p>'), block('b', '<p>二</p>')])
    const result = apply(article, [block('a', '<p>一</p>')], [])

    expect(result.removedKeys).toEqual(['b'])
    expect(article.querySelectorAll('p')).toHaveLength(1)
    expect(article.textContent).toBe('一')
  })

  it('插入新块插到正确位置', () => {
    const article = document.createElement('article')
    apply(article, [block('a', '<p>一</p>'), block('c', '<p>三</p>')])
    apply(article, [block('a', '<p>一</p>'), block('b', '<p>二</p>'), block('c', '<p>三</p>')], ['b'])

    expect(article.textContent).toBe('一二三')
  })

  it('内容不变时不改动 DOM', () => {
    const article = document.createElement('article')
    const blocks = [block('a', '<p>一</p>'), block('b', '<p>二</p>')]
    apply(article, blocks)
    const snapshot = Array.from(article.childNodes)

    const result = apply(article, blocks, [])
    expect(result.rebuiltKeys).toEqual([])
    expect(result.removedKeys).toEqual([])
    expect(Array.from(article.childNodes)).toEqual(snapshot)
  })

  it('块顺序变化时把节点搬到新位置', () => {
    const article = document.createElement('article')
    apply(article, [block('a', '<p>一</p>'), block('b', '<p>二</p>')])
    apply(article, [block('b', '<p>二</p>'), block('a', '<p>一</p>')], [])

    expect(article.textContent).toBe('二一')
  })

  it('HTML 里的事件属性在进入 DOM 前就已被消毒（这里只验证纯文本节点用法）', () => {
    const article = document.createElement('article')
    apply(article, [block('a', '<p>安全</p>')])
    expect(firstElement(article, 'p').textContent).toBe('安全')
  })
})

describe('appendBlocks', () => {
  it('只追加新增块，已有节点原样保留', () => {
    const article = document.createElement('article')
    const blocks = [block('a', '<p>一</p>'), block('b', '<p>二</p>')]
    appendBlocks(article, blocks, 0)
    expect(article.textContent).toBe('一二')

    const firstParagraph = firstElement(article, 'p')
    const extended = [...blocks, block('c', '<p>三</p>')]
    const appended = appendBlocks(article, extended, 2)

    expect(appended).toEqual(['c'])
    expect(article.textContent).toBe('一二三')
    expect(firstElement(article, 'p')).toBe(firstParagraph)
  })

  it('from 等于长度时不写 DOM', () => {
    const article = document.createElement('article')
    const blocks = [block('a', '<p>一</p>')]
    appendBlocks(article, blocks, 0)
    const before = Array.from(article.childNodes)

    expect(appendBlocks(article, blocks, 1)).toEqual([])
    expect(Array.from(article.childNodes)).toEqual(before)
  })
})

import type { RenderedBlock } from '@/lib/block-renderer'

/**
 * 把渲染好的块增量写进预览容器。
 *
 * 每块前面放一个注释节点当锚点（`<!--biu-block:key-->`）。注释不参与 CSS 选择器
 * （`:first-child`、`+` 兄弟选择器都只看元素），所以不影响预览排版，但让我们能在
 * 不重建整个 DOM 的前提下只替换变化的那一块——这是大文档不卡顿的关键：
 * 整篇 `innerHTML` 替换会让浏览器重新解析并重排 MB 级 DOM。
 *
 * 写入统一"拼字符串 + 一次解析 + 一次 appendChild"：逐块建 `<template>` 解析在上万块时
 * 光是解析开销就比渲染本身还大。
 */

const MARKER_PREFIX = 'biu-block:'

function markerFor(key: string): string {
  return `${MARKER_PREFIX}${key}`
}

function markerHtml(key: string): string {
  return `<!--${MARKER_PREFIX}${key}-->`
}

function keyOfMarker(node: Node): string | null {
  if (node.nodeType !== Node.COMMENT_NODE) return null
  const value = node.nodeValue ?? ''
  return value.startsWith(MARKER_PREFIX) ? value.slice(MARKER_PREFIX.length) : null
}

interface ExistingBlock {
  marker: Comment
  nodes: Node[]
}

export interface ApplyBlocksResult {
  /** 被重新创建（插入或替换）的块，水合只需要处理这些 */
  rebuiltKeys: string[]
  /** 被移除的块，用于中止它们的水合 */
  removedKeys: string[]
}

function indexExisting(article: HTMLElement): Map<string, ExistingBlock> {
  const existing = new Map<string, ExistingBlock>()
  let current: ExistingBlock | null = null
  for (const node of Array.from(article.childNodes)) {
    const key = keyOfMarker(node)
    if (key !== null) {
      current = { marker: node as Comment, nodes: [] }
      existing.set(key, current)
      continue
    }
    if (current) current.nodes.push(node)
  }
  return existing
}

/** 用已验证消毒过的 HTML 拼一段可一次解析的片段（含块锚点注释） */
function blockHtml(blocks: readonly RenderedBlock[], from: number, to: number): string {
  let html = ''
  for (let index = from; index < to; index++) {
    html += markerHtml(blocks[index].key) + blocks[index].html
  }
  return html
}

/** 解析成节点；template 不会执行脚本，且输入已经消毒过 */
function fragmentFromHtml(html: string): DocumentFragment {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

function removeBlock(article: HTMLElement, block: ExistingBlock): void {
  for (const node of block.nodes) article.removeChild(node)
  article.removeChild(block.marker)
}

/**
 * 只追加：调用方保证 article 里已经按顺序放着 `blocks[0..from-1]`。
 *
 * 分帧渲染时每帧都要写一次 DOM，走 `applyBlocks` 会重新索引整个文章（大文档上万节点）；
 * 这里把新增块拼成一段 HTML 一次解析、一次追加，成本只与新增内容相关。
 */
export function appendBlocks(
  article: HTMLElement,
  blocks: readonly RenderedBlock[],
  from: number
): string[] {
  if (from >= blocks.length) return []
  article.appendChild(fragmentFromHtml(blockHtml(blocks, from, blocks.length)))
  return blocks.slice(from).map((block) => block.key)
}

export function applyBlocks(
  article: HTMLElement,
  blocks: readonly RenderedBlock[],
  rebuiltCandidates: ReadonlySet<string>
): ApplyBlocksResult {
  if (article.childNodes.length === 0) {
    if (blocks.length > 0) {
      article.appendChild(fragmentFromHtml(blockHtml(blocks, 0, blocks.length)))
    }
    return { rebuiltKeys: blocks.map((block) => block.key), removedKeys: [] }
  }

  const existing = indexExisting(article)
  const rebuiltKeys: string[] = []
  const removedKeys: string[] = []

  const wanted = new Set(blocks.map((block) => block.key))
  for (const [key, block] of existing) {
    if (wanted.has(key)) continue
    removeBlock(article, block)
    existing.delete(key)
    removedKeys.push(key)
  }

  // cursor 指向「上一个块最后一个节点」，新块插在它后面
  let cursor: Node | null = null

  for (const block of blocks) {
    const entry = existing.get(block.key)
    const rebuild = rebuiltCandidates.has(block.key) || !entry

    if (!rebuild && entry) {
      const expected: Node | null = cursor ? cursor.nextSibling : article.firstChild
      if (expected === entry.marker) {
        cursor = entry.nodes.at(-1) ?? entry.marker
        continue
      }
      // 位置不对（块被移动过）：把现有节点整体搬到正确位置，保留已水合的图表
      const anchor: Node | null = cursor ? cursor.nextSibling : article.firstChild
      article.insertBefore(entry.marker, anchor)
      let moved: Node = entry.marker
      for (const node of entry.nodes) {
        article.insertBefore(node, moved.nextSibling)
        moved = node
      }
      cursor = moved
      continue
    }

    if (entry) {
      for (const node of entry.nodes) article.removeChild(node)
    }
    const marker = entry?.marker ?? document.createComment(markerFor(block.key))
    const insertAt: Node | null = cursor ? cursor.nextSibling : article.firstChild
    article.insertBefore(marker, insertAt)
    article.insertBefore(fragmentFromHtml(block.html), marker.nextSibling)
    // 取插入后的最后一个节点作为新的 cursor
    let last: Node = marker
    while (last.nextSibling && keyOfMarker(last.nextSibling) === null) {
      last = last.nextSibling
    }
    cursor = last
    rebuiltKeys.push(block.key)
  }

  return { rebuiltKeys, removedKeys }
}

import DOMPurify from 'dompurify'
import { renderMarkdown, type MarkdownRenderEnv } from '@/lib/markdown'
import { contextHashOf, IncrementalSplitter, type MarkdownSpan } from '@/lib/markdown-blocks'
import { PREVIEW_ALLOWED_URI_REGEXP } from '@shared/image-url'
import type { DiagramBlock } from '@shared/diagram'

export interface RenderedBlock {
  /** 文档内唯一：同内容块按出现次序带 `~n` 后缀，可直接用作 DOM 锚点与图表 id 前缀 */
  key: string
  /** 已消毒的 HTML，可直接插入 DOM */
  html: string
  diagrams: DiagramBlock[]
}

export interface BlockRenderOptions {
  /** 相对图片地址改写；为 null 表示保持原始引用 */
  resolveImageSrc?: (src: string) => string
  /** 文档路径会影响图片地址，参与块 key，保证换文档不会命中旧 HTML */
  documentPath?: string | null
}

export interface BlockRenderResult {
  /** 累计已渲染的块（从文档开头起，按顺序） */
  blocks: RenderedBlock[]
  /** 本次调用真正渲染出来的块 key */
  changedKeys: string[]
  segmented: boolean
  /** 放弃分段时的原因，便于排查"为什么没走增量" */
  reason?: string
  /** false 表示还有块没渲染完，调用方应在下一帧用同一个 `blocks` 数组继续 */
  done: boolean
}

/** 预览与导出必须用同一套消毒参数，这里与 `export-document.ts` 保持一致 */
const SANITIZE_OPTIONS = {
  ADD_ATTR: ['target', 'rel'],
  ADD_TAGS: ['iframe'],
  ALLOWED_URI_REGEXP: PREVIEW_ALLOWED_URI_REGEXP
}

/** 缓存条目上限：只影响命中率，不影响正确性 */
const MAX_CACHED_BLOCKS = 600

/**
 * 一次消毒多少块。
 *
 * Chromium 里 `DOMPurify.sanitize` 的开销基本按字节线性（约 0.5µs/字节），
 * 固定成本不大，所以批量大小主要决定**每帧的粒度**：太小会多掉几帧，
 * 太大则单帧超出预算。32 块（约 4KB）在 12ms 预算下大约能做三批。
 */
const SANITIZE_BATCH_SIZE = 32

const BLOCK_ATTR = 'data-biu-block'

interface Generation {
  content: string
  contextHash: string
  spans: MarkdownSpan[]
  segmented: boolean
  reason?: string
  /** 下一个待渲染的 span 下标 */
  next: number
  /**
   * 每个 span 实际使用的块 key（按需填充）。
   * 同一段内容在文档里可能出现多次，`span.key` 只由内容决定，
   * 不能直接当 DOM 锚点 / 图表 id 前缀，否则重复块会互相覆盖。
   */
  keys: string[]
  /** 同一份内容的出现次数，用来给重复块的 key 加后缀 */
  occurrences: Map<string, number>
  /** 已渲染的块。整个 generation 期间是同一个数组实例，调用方可据此判断"只是追加" */
  blocks: RenderedBlock[]
  done: boolean
}

interface RawBlock {
  key: string
  /** 尚未消毒的 markdown-it 输出 */
  html: string
  diagrams: DiagramBlock[]
}

/**
 * 按块渲染 + 缓存 + 分帧。
 *
 * 一次 `render()` 只会真正解析/消毒「还没渲染过的那几块」，其余块直接复用缓存；
 * 切块本身也是增量的（`IncrementalSplitter`）。
 *
 * 传入 `budgetMs` 时是**可分帧**的：本次只渲染到时间预算用完为止，返回 `done: false`，
 * 调用方下一帧再调一次即可接着渲染——大文档首屏因此不用一次性阻塞主线程。
 * 不传预算（默认 `Infinity`）时一次性渲染完，行为与之前一致。
 */
export class BlockRenderer {
  private cache = new Map<string, RenderedBlock>()
  private splitter = new IncrementalSplitter()
  private generation: Generation | null = null

  /**
   * @param budgetMs 本次渲染的时间预算；`Infinity` 表示一次性渲染完
   */
  render(content: string, options: BlockRenderOptions = {}, budgetMs = Infinity): BlockRenderResult {
    const contextHash = contextHashOf(options.documentPath ?? '')
    let generation = this.generation

    if (!generation || generation.content !== content || generation.contextHash !== contextHash) {
      const split = this.splitter.split(content, contextHash)
      generation = {
        content,
        contextHash,
        spans: split.spans,
        segmented: split.segmented,
        reason: split.reason,
        next: 0,
        keys: [],
        occurrences: new Map(),
        blocks: [],
        done: split.spans.length === 0
      }
      this.generation = generation
    }

    if (generation.done) {
      return {
        blocks: generation.blocks,
        changedKeys: [],
        segmented: generation.segmented,
        reason: generation.reason,
        done: true
      }
    }

    const deadline = budgetMs === Infinity ? Infinity : performance.now() + budgetMs
    const changedKeys: string[] = []
    const { spans } = generation

    while (generation.next < spans.length) {
      const key = this.spanKeyAt(generation, generation.next)
      const cached = this.cache.get(key)
      if (cached) {
        // 命中缓存几乎零成本，不受预算限制，否则大文档每次编辑都要分很多帧
        generation.blocks.push(cached)
        generation.next++
        continue
      }

      // 收集一段连续未命中的块，批量渲染 + 批量消毒（key 已按出现次序去重）
      const start = generation.next
      let end = start
      while (
        end < spans.length &&
        end - start < SANITIZE_BATCH_SIZE &&
        !this.cache.has(this.spanKeyAt(generation, end))
      ) {
        end++
      }

      for (const block of this.renderBatch(content, spans, generation.keys, start, end, options)) {
        this.cache.set(block.key, block)
        generation.blocks.push(block)
        changedKeys.push(block.key)
      }
      generation.next = end

      // 至少推进一批再检查预算，保证每次调用都有进展
      if (performance.now() >= deadline) break
    }

    generation.done = generation.next >= spans.length
    this.evict(generation.blocks)
    return {
      blocks: generation.blocks,
      changedKeys,
      segmented: generation.segmented,
      reason: generation.reason,
      done: generation.done
    }
  }

  /**
   * 取第 index 个 span 的块 key。
   *
   * `span.key` 只由内容与上下文决定（同时是缓存键），但同一段内容在文档里可能出现
   * 多次（重复段落、重复 `---`、重复代码块）。如果直接拿它当 DOM 锚点与图表 id 前缀，
   * 重复块会共用同一个锚点 / 图表 id，导致预览顺序错乱、水合只处理第一个。
   * 因此按出现次序给后面的副本加 `~n` 后缀，保证 key 在文档内唯一。
   */
  private spanKeyAt(generation: Generation, index: number): string {
    const { spans, keys, occurrences } = generation
    while (keys.length <= index) {
      const base = spans[keys.length].key
      const seen = occurrences.get(base) ?? 0
      occurrences.set(base, seen + 1)
      keys.push(seen === 0 ? base : `${base}~${seen}`)
    }
    return keys[index]
  }

  /** 渲染 [start, end) 这一段块；单块走直连路径，多块走批量消毒 */
  private renderBatch(
    content: string,
    spans: readonly MarkdownSpan[],
    keys: readonly string[],
    start: number,
    end: number,
    options: BlockRenderOptions
  ): RenderedBlock[] {
    const raw: RawBlock[] = []
    for (let index = start; index < end; index++) {
      const span = spans[index]
      raw.push(this.renderRaw(content.slice(span.start, span.end), keys[index], options))
    }
    if (raw.length === 1) {
      const only = raw[0]
      return [{ key: only.key, html: this.sanitize(only.html), diagrams: only.diagrams }]
    }
    return this.sanitizeBatch(raw)
  }

  private renderRaw(text: string, key: string, options: BlockRenderOptions): RawBlock {
    const diagrams: DiagramBlock[] = []
    const env: MarkdownRenderEnv = {
      diagrams,
      // id 前缀取块 key：跨块唯一，且与缓存里的 HTML 永久对应
      diagramIdPrefix: `${key}-`
    }
    if (options.resolveImageSrc) env.resolveImageSrc = options.resolveImageSrc
    return { key, html: renderMarkdown(text, env), diagrams }
  }

  private sanitize(html: string): string {
    return DOMPurify.sanitize(html, SANITIZE_OPTIONS) as unknown as string
  }

  /**
   * 批量消毒：把每块包进 `<div data-biu-block=key>` 后一次消毒，再按包装节点拆回来。
   * 包装节点同时充当 HTML 解析的修复边界（块内未闭合的标签不会吃到下一块）。
   */
  private sanitizeBatch(raw: readonly RawBlock[]): RenderedBlock[] {
    const wrapped = raw
      .map((block) => `<div ${BLOCK_ATTR}="${block.key}">${block.html}</div>`)
      .join('')
    const template = document.createElement('template')
    template.innerHTML = this.sanitize(wrapped)

    const sanitized = new Map<string, string>()
    for (const element of Array.from(template.content.children)) {
      const key = element.getAttribute(BLOCK_ATTR)
      if (key !== null) sanitized.set(key, element.innerHTML)
    }

    return raw.map((block) => ({
      key: block.key,
      // 包装节点被吃掉时（理论上不会）退回单块消毒，保证不会漏消毒
      html: sanitized.get(block.key) ?? this.sanitize(block.html),
      diagrams: block.diagrams
    }))
  }

  /**
   * 超出上限时按插入顺序丢弃，但绝不丢本次用到的块。
   * 当前文档本身就超过上限时直接跳过：那种情况下淘汰只会误伤，还会白白遍历一遍缓存。
   */
  private evict(current: RenderedBlock[]): void {
    if (current.length >= MAX_CACHED_BLOCKS) return
    if (this.cache.size <= MAX_CACHED_BLOCKS) return
    const inUse = new Set(current.map((block) => block.key))
    for (const key of this.cache.keys()) {
      if (this.cache.size <= MAX_CACHED_BLOCKS) break
      if (inUse.has(key)) continue
      this.cache.delete(key)
    }
  }

  /** 只用于测试与换文档时主动释放 */
  reset(): void {
    this.cache.clear()
    this.splitter.reset()
    this.generation = null
  }
}

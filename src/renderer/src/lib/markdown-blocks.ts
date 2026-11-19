/**
 * 把 Markdown 源码切成可以独立渲染的块（纯函数 + 增量状态机）。
 *
 * 动机：整篇一次 `markdown-it` 渲染 + DOMPurify 消毒在 MB 级文档上要几百毫秒到数秒，
 * 而用户每次输入只改动一小段。切成块之后就能只重渲染/重消毒变化的那一块。
 *
 * **正确性是硬约束**：只有当「逐块渲染后拼接」与「整篇渲染」逐字节相同时才允许切分。
 * 因此不是按空行无脑切，而是只在**可证明安全**的边界上切：
 *
 * - 空行就是候选边界——Markdown 的块大多以空行分隔；
 * - 围栏代码块内部不切（内部空行属于代码）。围栏允许缩进 1–3 个空格，
 *   所以只有行首 Tab 或 4 个以上空格才算缩进代码，不能看到空格就当成缩进；
 * - 空行之后的行以空白开头时不切（可能是列表续行、嵌套列表或缩进代码）；
 * - 空行之前是列表项、列表项的惰性续行、缩进代码或缩进围栏收尾时不切
 *   （可能仍在同一个列表项里，松/紧列表会因此产生 `<li><p>` 与 `<li>` 的差异）；
 * - 引用定义（`[foo]: url`）与脚注定义（`[^1]: ...`）作用域是整篇文档，出现即放弃分段；
 * - 以 `<` 开头的行可能是跨空行的原始 HTML 块，同样放弃分段。
 *
 * 放弃分段不降低正确性，只退回整篇渲染（`segmented: false`）。
 *
 * ## 增量切分
 *
 * 每次编辑都全文重扫是 O(n)。`IncrementalSplitter` 用「公共前后缀 + 局部重扫」把它降到
 * O(变化量 + 一次字符比较)。安全前提有两条，缺一不可：
 *
 * 1. **局部重扫必须从一个合法的块边界开始**。块边界意味着围栏已闭合，因此把这一段文本
 *    当成独立文档喂给同一个扫描器，内部的边界判定与全文扫描完全一致（判定只依赖相邻两行）。
 * 2. **接缝必须重新校验**。改动可能让新的下一行变成缩进行，从而与上一块粘连；所以每次
 *    拼接后都用与全量扫描相同的规则（`boundaryAllows`）检查窗口两侧的接缝，不通过就扩大
 *    窗口重试，最坏退回整篇重切。
 *
 * `markdown-blocks.test.ts` 里有一条随机编辑的性质测试：对 PRD.md / Arch.md 连续施加
 * 随机插入与删除，每一步都要求增量结果与「从头切一遍」逐块相同。
 */

export interface MarkdownSpan {
  /** 由块内容（与渲染上下文）决定，同一段文本永远得到同一个 key */
  key: string
  /** 在源码中的起始偏移（含） */
  start: number
  /** 在源码中的结束偏移（不含） */
  end: number
}

export interface SpanSplitResult {
  /** false 表示本次必须整篇渲染，spans 只有一项（整篇） */
  segmented: boolean
  /** 放弃分段的原因，仅用于调试与测试 */
  reason?: string
  spans: MarkdownSpan[]
}

const KIND_OTHER = 0
const KIND_BLANK = 1
const KIND_INDENTED = 2
const KIND_FENCE = 3
const KIND_ORDERED = 4
const KIND_UNORDERED = 5
/** 列表项的惰性续行（`- item` 后面不带缩进的普通文字行） */
const KIND_LAZY_LIST = 6

type BlockKind =
  | typeof KIND_OTHER
  | typeof KIND_BLANK
  | typeof KIND_INDENTED
  | typeof KIND_FENCE
  | typeof KIND_ORDERED
  | typeof KIND_UNORDERED
  | typeof KIND_LAZY_LIST

const CHAR_TAB = 9
const CHAR_SPACE = 32
const CHAR_RIGHT_PAREN = 41
const CHAR_STAR = 42
const CHAR_PLUS = 43
const CHAR_DASH = 45
const CHAR_DOT = 46
const CHAR_COLON = 58
const CHAR_LT = 60
const CHAR_OPEN_BRACKET = 91
const CHAR_CLOSE_BRACKET = 93
const CHAR_BACKTICK = 96
const CHAR_TILDE = 126

/** FNV-1a：够快、分布够均匀，只用来做缓存键，不做安全用途 */
function hashText(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function hashRange(content: string, start: number, end: number): string {
  let hash = 0x811c9dc5
  for (let index = start; index < end; index++) {
    hash ^= content.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * 块 key：内容哈希 + 长度 + 渲染上下文哈希。
 * 上下文（文档路径）会影响图片地址改写，所以路径变了 key 也要变，
 * 否则会命中旧上下文缓存下来的 HTML。
 */
export function spanKey(content: string, start: number, end: number, contextHash = ''): string {
  const length = end - start
  return `b${hashRange(content, start, end)}-${length.toString(36)}${contextHash ? `-${contextHash}` : ''}`
}

export function contextHashOf(value: string): string {
  return hashText(value)
}

function isSpaceLike(code: number): boolean {
  return code === CHAR_SPACE || code === CHAR_TAB
}

/** 行首是否有空白（用于判断收尾围栏是否缩进在列表项里） */
function lineIsIndented(content: string, start: number, end: number): boolean {
  return start < end && isSpaceLike(content.charCodeAt(start))
}

/**
 * 行首带空白（不区分 1 个还是 4 个空格）。
 *
 * 缩进的行可能是列表项的续行、嵌套列表或缩进代码——都属于"上一块的容器还没结束"，
 * 因此在它前面不切。这里宁可多合并一块，也不能把列表从中间切断。
 */
function startsWithSpace(content: string, position: number): boolean {
  return position < content.length && isSpaceLike(content.charCodeAt(position))
}

/**
 * CommonMark 的缩进代码：行首是 Tab，或 4 个以上空格。
 *
 * 围栏、引用定义、脚注定义、原始 HTML 都允许缩进 1–3 个空格，
 * 所以不能看到行首空格就当作缩进代码，否则这些构造会漏检。
 */
function lineStartsIndentedCode(content: string, start: number, end: number): boolean {
  if (start >= end) return false
  if (content.charCodeAt(start) === CHAR_TAB) return true
  let spaces = 0
  for (let index = start; index < end; index++) {
    if (content.charCodeAt(index) !== CHAR_SPACE) break
    spaces++
    if (spaces >= 4) return true
  }
  return false
}

function lineIsBlank(content: string, start: number, end: number): boolean {
  for (let index = start; index < end; index++) {
    if (!isSpaceLike(content.charCodeAt(index))) return false
  }
  return true
}

/** 最多跳 3 个前导空格（CommonMark 的块级缩进容忍度） */
function skipIndent(content: string, start: number, end: number): number {
  let index = start
  let spaces = 0
  while (index < end && content.charCodeAt(index) === CHAR_SPACE && spaces < 4) {
    index++
    spaces++
  }
  return index
}

function listKindAt(content: string, start: number, end: number): BlockKind {
  if (start >= end) return KIND_OTHER
  const code = content.charCodeAt(start)

  if (code === CHAR_DASH || code === CHAR_STAR || code === CHAR_PLUS) {
    const after = start + 1
    if (after >= end || isSpaceLike(content.charCodeAt(after))) return KIND_UNORDERED
    return KIND_OTHER
  }

  if (code >= 48 && code <= 57) {
    let index = start
    let digits = 0
    while (index < end && digits < 9) {
      const digit = content.charCodeAt(index)
      if (digit < 48 || digit > 57) break
      index++
      digits++
    }
    if (digits === 0 || index >= end) return KIND_OTHER
    const marker = content.charCodeAt(index)
    if (marker !== CHAR_DOT && marker !== CHAR_RIGHT_PAREN) return KIND_OTHER
    const after = index + 1
    if (after >= end || isSpaceLike(content.charCodeAt(after))) return KIND_ORDERED
  }

  return KIND_OTHER
}

interface LineScan {
  kind: BlockKind
  fenceChar: number
  fenceLength: number
  /** 围栏标记之后还有内容（info string），说明这是开始围栏而不是收尾 */
  fenceHasInfo: boolean
  referenceDefinition: boolean
  rawHtml: boolean
}

/**
 * 行扫描的共享缓冲：每行都新建对象会让 130k 行的文档产生大量垃圾，
 * 这里复用同一个对象。调用方必须在下一次调用前把需要的标量取走。
 */
const scanBuffer: LineScan = {
  kind: KIND_OTHER,
  fenceChar: 0,
  fenceLength: 0,
  fenceHasInfo: false,
  referenceDefinition: false,
  rawHtml: false
}

function scanLine(content: string, start: number, end: number): LineScan {
  const scan = scanBuffer
  scan.kind = KIND_OTHER
  scan.fenceChar = 0
  scan.fenceLength = 0
  scan.fenceHasInfo = false
  scan.referenceDefinition = false
  scan.rawHtml = false

  if (start >= end || lineIsBlank(content, start, end)) {
    scan.kind = KIND_BLANK
    return scan
  }

  if (lineStartsIndentedCode(content, start, end)) {
    scan.kind = KIND_INDENTED
    return scan
  }

  const first = skipIndent(content, start, end)
  if (first >= end) return scan
  const firstCode = content.charCodeAt(first)

  if (firstCode === CHAR_BACKTICK || firstCode === CHAR_TILDE) {
    let length = 0
    let index = first
    while (index < end && content.charCodeAt(index) === firstCode) {
      length++
      index++
    }
    if (length >= 3) {
      scan.kind = KIND_FENCE
      scan.fenceChar = firstCode
      scan.fenceLength = length
      for (let rest = index; rest < end; rest++) {
        if (!isSpaceLike(content.charCodeAt(rest))) {
          scan.fenceHasInfo = true
          break
        }
      }
      return scan
    }
  }

  if (firstCode === CHAR_LT) scan.rawHtml = true

  // 引用定义 [label]: ...（脚注 [^1]: ... 也命中这条）
  if (firstCode === CHAR_OPEN_BRACKET) {
    let index = first + 1
    let closed = -1
    while (index < end) {
      if (content.charCodeAt(index) === CHAR_CLOSE_BRACKET) {
        closed = index
        break
      }
      index++
    }
    if (closed > first + 1 && closed + 1 < end && content.charCodeAt(closed + 1) === CHAR_COLON) {
      scan.referenceDefinition = true
    }
  }

  scan.kind = listKindAt(content, first, end)
  return scan
}

/** 这些块之后不允许切：可能仍在同一个列表项里 */
function isOpenBlockLike(kind: BlockKind): boolean {
  return (
    kind === KIND_INDENTED ||
    kind === KIND_FENCE ||
    kind === KIND_ORDERED ||
    kind === KIND_UNORDERED ||
    kind === KIND_LAZY_LIST
  )
}

/** 与全量扫描完全相同的边界规则：这个接缝还能不能切 */
function boundaryAllows(previousKind: BlockKind, nextKind: BlockKind): boolean {
  if (nextKind === KIND_INDENTED) return false
  return !isOpenBlockLike(previousKind)
}

/** 取某个位置所在行的类型（只看这一行，供接缝校验用） */
function lineKindAt(content: string, position: number): BlockKind {
  if (position >= content.length) return KIND_BLANK
  const breakIndex = content.indexOf('\n', position)
  const end = breakIndex === -1 ? content.length : breakIndex
  return scanLine(content, position, end).kind
}

/** 前后缀比较的分块大小：`slice` + `===` 在 V8 里是 memcmp，比逐字符快数倍 */
const DIFF_CHUNK = 2048

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let index = 0
  while (index + DIFF_CHUNK <= max && a.slice(index, index + DIFF_CHUNK) === b.slice(index, index + DIFF_CHUNK)) {
    index += DIFF_CHUNK
  }
  while (index < max && a.charCodeAt(index) === b.charCodeAt(index)) index++
  return index
}

function commonSuffixLength(a: string, b: string, max: number): number {
  let length = 0
  while (length + DIFF_CHUNK <= max) {
    const aStart = a.length - length - DIFF_CHUNK
    const bStart = b.length - length - DIFF_CHUNK
    if (a.slice(aStart, aStart + DIFF_CHUNK) !== b.slice(bStart, bStart + DIFF_CHUNK)) break
    length += DIFF_CHUNK
  }
  while (
    length < max &&
    a.charCodeAt(a.length - 1 - length) === b.charCodeAt(b.length - 1 - length)
  ) {
    length++
  }
  return length
}

interface RegionScan {
  spans: Array<{ start: number; end: number }>
  /** 与 spans 一一对应：该块最后一行的类型，用于接缝校验 */
  endKinds: BlockKind[]
  reasons: string[]
}

/**
 * 扫描 [regionStart, regionEnd) 区域，产出块跨度。
 *
 * 调用方必须保证 `regionStart` 落在**合法的块边界**上（围栏已闭合），
 * 这样围栏状态可以当作"已闭合"重新起算，边界判定与全文扫描一致。
 */
function scanRegion(content: string, regionStart: number, regionEnd: number): RegionScan {
  const spans: Array<{ start: number; end: number }> = []
  const endKinds: BlockKind[] = []
  const reasons: string[] = []

  let segmentStart = -1
  let segmentEnd = -1
  let fenceChar = 0
  let fenceLength = 0
  let lastKind: BlockKind = KIND_BLANK
  /** 上一物理行的类型：用来识别列表项的惰性续行 */
  let previousKind: BlockKind = KIND_BLANK
  let position = regionStart

  const markContent = (start: number, end: number): void => {
    if (segmentStart === -1) segmentStart = start
    segmentEnd = end
  }

  const flush = (): void => {
    if (segmentStart === -1 || segmentEnd <= segmentStart) {
      segmentStart = -1
      segmentEnd = -1
      return
    }
    spans.push({ start: segmentStart, end: segmentEnd })
    endKinds.push(lastKind)
    segmentStart = -1
    segmentEnd = -1
  }

  while (position < regionEnd) {
    const lineBreak = content.indexOf('\n', position)
    const lineEnd = lineBreak === -1 || lineBreak >= regionEnd ? regionEnd : lineBreak
    const nextPosition = lineEnd >= regionEnd ? regionEnd : lineEnd + 1
    const scan = scanLine(content, position, lineEnd)

    if (scan.kind === KIND_FENCE || fenceLength > 0) {
      if (scan.kind === KIND_FENCE) {
        if (fenceLength === 0) {
          fenceChar = scan.fenceChar
          fenceLength = scan.fenceLength
          lastKind = KIND_FENCE
        } else if (
          scan.fenceChar === fenceChar &&
          scan.fenceLength >= fenceLength &&
          !scan.fenceHasInfo
        ) {
          // 缩进的收尾围栏通常位于列表项内部，之后不切；顶格的可以切
          lastKind = lineIsIndented(content, position, lineEnd) ? KIND_FENCE : KIND_OTHER
          fenceChar = 0
          fenceLength = 0
        }
      }
      markContent(position, lineEnd)
      previousKind = KIND_FENCE
      position = nextPosition
      continue
    }

    if (scan.kind === KIND_BLANK) {
      // 吞掉整段连续空行，再判断这个边界能不能切
      let lookahead = position
      let nextStart = -1
      let nextKind: BlockKind = KIND_BLANK
      while (lookahead < regionEnd) {
        const breakIndex = content.indexOf('\n', lookahead)
        const endIndex = breakIndex === -1 || breakIndex >= regionEnd ? regionEnd : breakIndex
        const nextScan = scanLine(content, lookahead, endIndex)
        if (nextScan.kind !== KIND_BLANK) {
          nextStart = lookahead
          nextKind = nextScan.kind
          break
        }
        if (endIndex >= regionEnd) break
        lookahead = endIndex + 1
      }

      if (nextStart === -1) break

      if (!startsWithSpace(content, nextStart) && boundaryAllows(lastKind, nextKind)) {
        flush()
        lastKind = KIND_BLANK
      }
      previousKind = KIND_BLANK
      position = nextStart
      continue
    }

    if (scan.referenceDefinition) reasons.push(`reference definition near offset ${position}`)
    if (scan.rawHtml) reasons.push(`raw html near offset ${position}`)

    // 列表项后面不带缩进的普通文字行是「惰性续行」，仍属于这个列表项；
    // 这里把它记成未闭合类型，避免下一个空行被当成安全的切分点。
    const lazyList: boolean =
      scan.kind === KIND_OTHER &&
      (previousKind === KIND_ORDERED ||
        previousKind === KIND_UNORDERED ||
        previousKind === KIND_LAZY_LIST)

    markContent(position, lineEnd)
    lastKind = lazyList ? KIND_LAZY_LIST : scan.kind
    previousKind = lastKind
    position = nextPosition
  }

  flush()
  return { spans, endKinds, reasons }
}

/** 一次性切分（相当于「从头切一遍」） */
export function splitMarkdownSpans(content: string, contextHash = ''): SpanSplitResult {
  if (content.length === 0) return { segmented: true, spans: [] }

  const region = scanRegion(content, 0, content.length)
  if (region.reasons.length > 0) {
    return {
      segmented: false,
      reason: region.reasons[0],
      spans: [{ key: spanKey(content, 0, content.length, contextHash), start: 0, end: content.length }]
    }
  }

  return {
    segmented: true,
    spans: region.spans.map((span) => ({
      key: spanKey(content, span.start, span.end, contextHash),
      start: span.start,
      end: span.end
    }))
  }
}

interface InternalSpan {
  key: string
  start: number
  end: number
}

/** 接缝校验失败时最多扩几轮窗口，超了就直接整篇重切 */
const MAX_WINDOW_EXPANSIONS = 8

/**
 * 增量切分器：记住上一次的块划分，只重扫改动所在的窗口。
 *
 * 用法：把它挂在渲染器实例上，每次内容变化调用 `split(next, contextHash)`。
 * 任何它不确定的情况（上下文变化、上一轮就是整篇回退、窗口两侧接缝对不上、
 * 改动吞掉了整个窗口……）都会退回整篇重切，因此结果永远等价于「从头切一遍」。
 */
export class IncrementalSplitter {
  private content = ''
  private contextHash = ''
  private spans: InternalSpan[] = []
  private endKinds: BlockKind[] = []
  private segmented = true
  private reason: string | undefined

  /**
   * 增量命中统计。只用于测试与排查"为什么这次没走增量"，
   * 不影响任何渲染行为。
   */
  readonly stats = { full: 0, incremental: 0 }

  split(next: string, contextHash = ''): SpanSplitResult {
    if (contextHash !== this.contextHash || !this.segmented || this.content === '') {
      this.fullSplit(next, contextHash)
      return this.snapshot()
    }
    if (next === this.content) return this.snapshot()
    if (!this.incrementalSplit(next)) {
      this.fullSplit(next, contextHash)
      return this.snapshot()
    }
    this.stats.incremental++
    return this.snapshot()
  }

  reset(): void {
    this.content = ''
    this.contextHash = ''
    this.spans = []
    this.endKinds = []
    this.segmented = true
    this.reason = undefined
  }

  private snapshot(): SpanSplitResult {
    return { segmented: this.segmented, reason: this.reason, spans: this.spans }
  }

  private fullSplit(next: string, contextHash: string): void {
    this.stats.full++
    this.content = next
    this.contextHash = contextHash
    this.reason = undefined

    if (next.length === 0) {
      this.spans = []
      this.endKinds = []
      this.segmented = true
      return
    }

    const region = scanRegion(next, 0, next.length)
    if (region.reasons.length > 0) {
      this.segmented = false
      this.reason = region.reasons[0]
      this.spans = [
        { key: spanKey(next, 0, next.length, contextHash), start: 0, end: next.length }
      ]
      this.endKinds = [KIND_OTHER]
      return
    }

    this.segmented = true
    this.spans = region.spans.map((span) => ({
      key: spanKey(next, span.start, span.end, contextHash),
      start: span.start,
      end: span.end
    }))
    this.endKinds = region.endKinds
  }

  /** 返回 false 表示"拿不准"，调用方需要整篇重切 */
  private incrementalSplit(next: string): boolean {
    const oldContent = this.content
    const oldLength = oldContent.length
    const newLength = next.length
    if (oldLength === 0 || newLength === 0 || this.spans.length === 0) return false

    // 公共前后缀：分块 memcmp，比重新切块便宜得多
    const prefix = commonPrefixLength(oldContent, next)
    const suffix = commonSuffixLength(
      oldContent,
      next,
      Math.min(oldLength - prefix, newLength - prefix)
    )

    const delta = newLength - oldLength
    const changeOldEnd = oldLength - suffix
    const changeNewEnd = newLength - suffix

    let i0 = this.spanIndexAt(prefix)
    let j0 = this.spanIndexAt(changeOldEnd)
    // 先各扩一块邻居，接缝校验才有"外面的块"可以参照
    if (i0 > 0) i0--
    if (j0 < this.spans.length - 1) j0++

    for (let attempt = 0; attempt < MAX_WINDOW_EXPANSIONS; attempt++) {
      const windowStart = this.spans[i0].start
      const windowEndNew = Math.min(
        newLength,
        Math.max(this.spans[j0].end + delta, changeNewEnd)
      )
      if (windowEndNew <= windowStart) return false

      const region = scanRegion(next, windowStart, windowEndNew)
      // 窗口内出现引用定义/原始 HTML：整篇必须回退，交给 fullSplit 处理
      if (region.reasons.length > 0) return false

      const front = this.spans.slice(0, i0)
      const back = this.spans
        .slice(j0 + 1)
        .map((span) => ({ key: span.key, start: span.start + delta, end: span.end + delta }))
      const middle = region.spans.map((span) => ({
        key: spanKey(next, span.start, span.end, this.contextHash),
        start: span.start,
        end: span.end
      }))

      if (this.seamsOk(next, front, middle, back, i0, region.endKinds)) {
        this.content = next
        this.spans = [...front, ...middle, ...back]
        this.endKinds = [...this.endKinds.slice(0, i0), ...region.endKinds, ...this.endKinds.slice(j0 + 1)]
        return true
      }

      // 接缝不成立：扩大窗口重试（最坏覆盖整篇，就等价于整篇重切）
      if (i0 > 0) i0--
      else if (j0 < this.spans.length - 1) j0++
      else return false
    }

    return false
  }

  /**
   * 校验窗口两侧的接缝。规则与全量扫描完全一致：
   * 下一块首行是缩进行、或上一块最后一行属于"未闭合"的块，就不该在这里切。
   */
  private seamsOk(
    next: string,
    front: InternalSpan[],
    middle: InternalSpan[],
    back: InternalSpan[],
    i0: number,
    middleEndKinds: BlockKind[]
  ): boolean {
    const previousIndex = i0 - 1
    const hasPrevious = previousIndex >= 0
    const allowsSeam = (kind: BlockKind, start: number): boolean =>
      start < 0 || (!startsWithSpace(next, start) && boundaryAllows(kind, lineKindAt(next, start)))

    if (hasPrevious) {
      const previousEndKind = this.endKinds[previousIndex]
      const followingStart = middle.length > 0 ? middle[0].start : back.length > 0 ? back[0].start : -1
      if (followingStart >= 0 && !allowsSeam(previousEndKind, followingStart)) {
        return false
      }
    }

    if (back.length > 0) {
      if (middle.length > 0) {
        const lastMiddleKind = middleEndKinds[middleEndKinds.length - 1]
        if (!allowsSeam(lastMiddleKind, back[0].start)) return false
      } else if (hasPrevious) {
        // 窗口被改空：等价于「上一块」直接接「下一块」
        if (!allowsSeam(this.endKinds[previousIndex], back[0].start)) return false
      }
    }

    return true
  }

  /** 二分找最后一个 start <= position 的块 */
  private spanIndexAt(position: number): number {
    let low = 0
    let high = this.spans.length - 1
    let answer = 0
    while (low <= high) {
      const mid = (low + high) >> 1
      if (this.spans[mid].start <= position) {
        answer = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    return answer
  }
}

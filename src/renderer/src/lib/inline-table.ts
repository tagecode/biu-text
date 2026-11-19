import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import DOMPurify from 'dompurify'
import { renderMarkdownInline } from '@/lib/markdown'

export type TableAlignment = 'left' | 'center' | 'right' | null

export interface TableCell {
  /** 去掉首尾空白后的单元格源码 */
  text: string
  /** 单元格内容在文档中的绝对起点，点击后把光标放到这里 */
  offset: number
}

export interface TableModel {
  from: number
  to: number
  /** 原始表格源码，用于判断 decoration 是否需要重建 */
  source: string
  alignments: TableAlignment[]
  header: TableCell[]
  rows: TableCell[][]
}

export interface InlineTableOptions {
  /** 表格的读屏标签，例如「表格，点击单元格进入编辑」 */
  label: string
}

/**
 * 按 GFM 规则切分一行表格单元格。
 *
 * 只有未转义的 `|` 是分隔符；`\|` 是单元格内容里的字面管道符。行首/行尾的
 * 管道符会产出一个空片段，需要丢掉，但中间的 `||` 必须保留为空单元格。
 */
function splitRow(line: string, lineStart: number): TableCell[] {
  const cells: TableCell[] = []
  const push = (start: number, end: number): void => {
    const raw = line.slice(start, end)
    const leading = raw.length - raw.trimStart().length
    cells.push({
      text: raw.trim().replace(/\\\|/g, '|'),
      offset: lineStart + start + leading
    })
  }

  let segmentStart = 0
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === '|') {
      push(segmentStart, index)
      segmentStart = index + 1
    }
  }
  push(segmentStart, line.length)

  if (cells.length > 1 && line.trimStart().startsWith('|')) cells.shift()
  if (cells.length > 0 && line.trimEnd().endsWith('|')) cells.pop()
  return cells
}

function parseAlignments(cells: TableCell[]): TableAlignment[] | null {
  const alignments: TableAlignment[] = []
  for (const cell of cells) {
    if (!/^:?-+:?$/.test(cell.text)) return null
    const left = cell.text.startsWith(':')
    const right = cell.text.endsWith(':')
    alignments.push(left && right ? 'center' : left ? 'left' : right ? 'right' : null)
  }
  return alignments
}

/**
 * 解析一段 GFM 表格源码（不含围栏，纯文本行）。
 *
 * 返回的 `header` / `rows` 中的偏移是相对 `baseOffset` 的绝对位置，
 * 因此调用方传入表格起始位置即可直接用来 dispatch selection。
 */
export function parseTableSource(
  source: string,
  baseOffset = 0
): Pick<TableModel, 'alignments' | 'header' | 'rows'> | null {
  const lines: Array<{ text: string; start: number }> = []
  let offset = baseOffset
  for (const raw of source.split('\n')) {
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    lines.push({ text, start: offset })
    offset += raw.length + 1
  }
  if (lines.length < 2) return null

  const header = splitRow(lines[0].text, lines[0].start)
  const alignments = parseAlignments(splitRow(lines[1].text, lines[1].start))
  if (!alignments || header.length === 0 || alignments.length !== header.length) return null

  const rows = lines.slice(2).map((line) => {
    const cells = splitRow(line.text, line.start)
    if (cells.length > header.length) return cells.slice(0, header.length)
    if (cells.length < header.length) {
      const filler: TableCell = { text: '', offset: line.start + line.text.length }
      return [...cells, ...Array.from({ length: header.length - cells.length }, () => filler)]
    }
    return cells
  })

  return { alignments, header, rows }
}

/** 文档里所有顶层 GFM 表格；列表/引用里的表格保持源码，避免破坏块级布局 */
export function listTableBlocks(state: EditorState): TableModel[] {
  const blocks: TableModel[] = []
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table') return
      if (node.node.parent?.name !== 'Document') return

      const from = state.doc.lineAt(node.from).from
      const to = state.doc.lineAt(Math.max(node.from, node.to - 1)).to
      const source = state.sliceDoc(from, to)
      const parsed = parseTableSource(source, from)
      if (parsed) blocks.push({ from, to, source, ...parsed })
    }
  })
  return blocks
}

function selectionHitsTable(state: EditorState, from: number, to: number): boolean {
  const startLine = state.doc.lineAt(from).number
  const endLine = state.doc.lineAt(Math.max(from, to - 1)).number
  return state.selection.ranges.some((range) => {
    const head = state.doc.lineAt(Math.min(range.anchor, range.head)).number
    const anchor = state.doc.lineAt(Math.max(range.anchor, range.head)).number
    return head <= endLine && anchor >= startLine
  })
}

function sanitizeCell(text: string): string {
  return DOMPurify.sanitize(renderMarkdownInline(text), { USE_PROFILES: { html: true } })
}

function buildTableElement(block: TableModel, label: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'cm-inline-table-wrap'

  const table = document.createElement('table')
  table.className = 'cm-inline-table'
  table.setAttribute('aria-label', label)

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  block.header.forEach((cell, index) => {
    const th = document.createElement('th')
    th.innerHTML = sanitizeCell(cell.text)
    th.dataset.tablePos = String(cell.offset)
    const align = block.alignments[index]
    if (align) th.style.textAlign = align
    headRow.append(th)
  })
  thead.append(headRow)
  table.append(thead)

  const tbody = document.createElement('tbody')
  for (const row of block.rows) {
    const tr = document.createElement('tr')
    row.forEach((cell, index) => {
      const td = document.createElement('td')
      td.innerHTML = sanitizeCell(cell.text)
      td.dataset.tablePos = String(cell.offset)
      const align = block.alignments[index]
      if (align) td.style.textAlign = align
      tr.append(td)
    })
    tbody.append(tr)
  }
  table.append(tbody)
  wrap.append(table)
  return wrap
}

class TableWidget extends WidgetType {
  constructor(
    readonly block: TableModel,
    readonly label: string
  ) {
    super()
  }

  eq(other: TableWidget): boolean {
    return other.block.source === this.block.source && other.label === this.label
  }

  toDOM(): HTMLElement {
    return buildTableElement(this.block, this.label)
  }

  /** 点击单元格时把光标放到对应源码位置，表格随即退回源码模式 */
  ignoreEvent(event: Event): boolean {
    if (event.type !== 'mousedown') return false
    const target = event.target
    if (!(target instanceof HTMLElement)) return false
    const cell = target.closest<HTMLElement>('[data-table-pos]')
    if (!cell) return false

    const view = EditorView.findFromDOM(cell.closest<HTMLElement>('.cm-editor') ?? cell)
    const anchor = Number(cell.dataset.tablePos)
    if (!view || !Number.isFinite(anchor)) return true

    event.preventDefault()
    view.dispatch({ selection: { anchor: Math.min(anchor, view.state.doc.length) } })
    view.focus()
    return true
  }
}

function buildTableDecorations(state: EditorState, options: InlineTableOptions): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const block of listTableBlocks(state)) {
    if (selectionHitsTable(state, block.from, block.to)) continue
    builder.add(
      block.from,
      block.to,
      Decoration.replace({
        widget: new TableWidget(block, options.label),
        block: true
      })
    )
  }
  return builder.finish()
}

/** 测试与插件共用：光标不在表格内时，返回被替换成预览的表格范围 */
export function tableDecorationRanges(state: EditorState): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = []
  buildTableDecorations(state, { label: '表格' }).between(0, state.doc.length, (from, to) => {
    ranges.push({ from, to })
  })
  return ranges
}

export function inlineTables(options: InlineTableOptions): Extension {
  // block decoration 必须由 StateField 提供，ViewPlugin 提供的 block decoration
  // 会在渲染时报「Block decorations may not be specified via plugins」。
  return StateField.define<DecorationSet>({
    create: (state) => buildTableDecorations(state, options),
    update(decorations, transaction) {
      const treeChanged = syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
      if (transaction.docChanged || transaction.selection || treeChanged) {
        return buildTableDecorations(transaction.state, options)
      }
      return decorations.map(transaction.changes)
    },
    provide: (field) => EditorView.decorations.from(field)
  })
}

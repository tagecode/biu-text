// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { inlineTables, listTableBlocks, parseTableSource, tableDecorationRanges } from './inline-table'

function stateWith(doc: string, anchor = 0, head = anchor): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [markdown({ base: markdownLanguage })]
  })
}

describe('parseTableSource', () => {
  it('reads the header, alignments and body cells', () => {
    const parsed = parseTableSource(['| Name | Age |', '| :--- | ---: |', '| Ada | 36 |'].join('\n'))

    expect(parsed?.header.map((cell) => cell.text)).toEqual(['Name', 'Age'])
    expect(parsed?.alignments).toEqual(['left', 'right'])
    expect(parsed?.rows.map((row) => row.map((cell) => cell.text))).toEqual([['Ada', '36']])
  })

  it('keeps offsets absolute and points at the trimmed content', () => {
    const source = ['| Name | Age |', '| --- | --- |', '| Ada | 36 |'].join('\n')
    const parsed = parseTableSource(source, 100)

    expect(parsed?.header[0]?.offset).toBe(102)
    expect(source.slice(2, 6)).toBe('Name')
    expect(parsed?.rows[0]?.[1]?.offset).toBe(100 + source.indexOf('36'))
  })

  it('unescapes escaped pipes and keeps inner empty cells', () => {
    const parsed = parseTableSource(['| a \\| b | c | d |', '| --- | --- | --- |', '| 1 || 3 |'].join('\n'))

    expect(parsed?.header.map((cell) => cell.text)).toEqual(['a | b', 'c', 'd'])
    expect(parsed?.rows[0]?.map((cell) => cell.text)).toEqual(['1', '', '3'])
  })

  it('accepts a table without outer pipes', () => {
    const parsed = parseTableSource(['a | b', '--- | :---:', 'c | d'].join('\n'))

    expect(parsed?.header.map((cell) => cell.text)).toEqual(['a', 'b'])
    expect(parsed?.alignments).toEqual([null, 'center'])
    expect(parsed?.rows[0]?.map((cell) => cell.text)).toEqual(['c', 'd'])
  })

  it('pads short rows and trims long rows to the header width', () => {
    const parsed = parseTableSource(['| a | b |', '| - | - |', '| 1 |', '| 1 | 2 | 3 |'].join('\n'))

    expect(parsed?.rows[0]?.map((cell) => cell.text)).toEqual(['1', ''])
    expect(parsed?.rows[1]?.map((cell) => cell.text)).toEqual(['1', '2'])
  })

  it('returns null for invalid delimiters, missing rows or an empty header', () => {
    expect(parseTableSource('| a | b |')).toBeNull()
    expect(parseTableSource(['| a | b |', '| - | x |', '| 1 | 2 |'].join('\n'))).toBeNull()
    expect(parseTableSource(['| a | b |', '| --- |', '| 1 | 2 |'].join('\n'))).toBeNull()
    expect(parseTableSource(['|', '| --- |', '| 1 |'].join('\n'))).toBeNull()
  })
})

describe('listTableBlocks', () => {
  it('covers the whole table and stops before the next paragraph', () => {
    const doc = ['# Title', '', '| a | b |', '| --- | --- |', '| 1 | 2 |', '', 'after'].join('\n')
    const blocks = listTableBlocks(stateWith(doc))

    expect(blocks).toHaveLength(1)
    expect(doc.slice(blocks[0]!.from, blocks[0]!.to)).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(blocks[0]!.header[0]?.offset).toBe(doc.indexOf('a'))
    expect(blocks[0]!.rows[0]?.[1]?.offset).toBe(doc.lastIndexOf('2'))
  })

  it('keeps tables inside lists or quotes as source', () => {
    const quoted = ['> | a | b |', '> | --- | --- |', '> | 1 | 2 |', ''].join('\n')
    const listed = ['- item', '', '  | a | b |', '  | --- | --- |', '  | 1 | 2 |', ''].join('\n')

    expect(listTableBlocks(stateWith(quoted))).toEqual([])
    expect(listTableBlocks(stateWith(listed))).toEqual([])
  })
})

describe('tableDecorationRanges', () => {
  const doc = ['before', '', '| a | b |', '| --- | --- |', '| 1 | 2 |', '', 'after'].join('\n')

  it('replaces the table with a preview while the cursor is outside it', () => {
    const ranges = tableDecorationRanges(stateWith(doc, 0))

    expect(ranges).toHaveLength(1)
    expect(doc.slice(ranges[0]!.from, ranges[0]!.to)).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |')
  })

  it('reveals the source while the cursor or a selection touches the table', () => {
    expect(tableDecorationRanges(stateWith(doc, doc.indexOf('b', doc.indexOf('|'))))).toEqual([])
    expect(tableDecorationRanges(stateWith(doc, 0, doc.indexOf('1')))).toEqual([])
  })
})

describe('table widget', () => {
  it('moves the cursor into the source cell on mousedown', () => {
    const doc = ['intro', '', '| Name | Age |', '| --- | --- |', '| Ada | 36 |', ''].join('\n')
    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage }), inlineTables({ label: '表格' })]
    })
    const view = new EditorView({ state, parent: document.body })

    try {
      const cell = view.dom.querySelector<HTMLElement>('[data-table-pos]')
      expect(cell).not.toBeNull()

      cell!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

      expect(view.state.selection.main.anchor).toBe(doc.indexOf('Name'))
      // 光标进入表格后 decoration 撤掉，回到可编辑的源码
      expect(view.dom.querySelector('[data-table-pos]')).toBeNull()
    } finally {
      view.destroy()
    }
  })
})

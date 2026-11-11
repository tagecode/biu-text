import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { inlineDiagrams, mermaidBlocksToPreview, mermaidDecorationRanges, pinMermaidSource, unpinMermaidSource } from './inline-diagram'

const labels = { source: '源码', preview: '预览', renderFailed: '图表渲染失败' }

function stateWith(doc: string, anchor: number, head = anchor): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [markdown({ base: markdownLanguage }), inlineDiagrams({ theme: 'light', labels })]
  })
}

describe('mermaidBlocksToPreview', () => {
  it('previews a mermaid fence when the cursor is outside it', () => {
    const doc = 'before\n```mermaid\ngraph TD\n  A-->B\n```\n'
    const blocks = mermaidBlocksToPreview(stateWith(doc, 0))

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.code).toBe('graph TD\n  A-->B')
    expect(doc.slice(blocks[0]!.from, blocks[0]!.to)).toContain('```mermaid')
  })

  it('keeps the source while the cursor or selection touches the fence', () => {
    const doc = 'before\n```mermaid\ngraph TD\n```\n'
    expect(mermaidBlocksToPreview(stateWith(doc, doc.indexOf('graph')))).toEqual([])
    expect(mermaidBlocksToPreview(stateWith(doc, 0, doc.indexOf('graph')))).toEqual([])
  })

  it('ignores other languages and indented code, and reads the first info word', () => {
    const doc = ['```js', 'const a = 1', '```', '    graph TD', '~~~~mermaid extra', 'graph LR', '~~~~', ''].join('\n')
    const blocks = mermaidBlocksToPreview(stateWith(doc, 0))

    expect(blocks.map((block) => block.code)).toEqual(['graph LR'])
  })

  it('treats the info string as case-insensitive and allows an empty body', () => {
    const doc = 'note\n```Mermaid\n```\n'
    const blocks = mermaidBlocksToPreview(stateWith(doc, 0))

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.code).toBe('')
  })

  it('pins a block to source and lets it return to preview', () => {
    const doc = 'before\n```mermaid\ngraph TD\n```\n'
    let state = stateWith(doc, 0)
    const block = mermaidBlocksToPreview(state)[0]
    expect(block).toBeDefined()

    state = state.update({
      effects: pinMermaidSource.of({ from: block!.from, to: block!.to })
    }).state
    expect(mermaidBlocksToPreview(state)).toEqual([])

    state = state.update({
      effects: unpinMermaidSource.of({ from: block!.from, to: block!.to })
    }).state
    expect(mermaidBlocksToPreview(state).map((item) => item.code)).toEqual(['graph TD'])
  })

  it('replaces the fence, and leaves a pinned fence as a source toggle', () => {
    const doc = 'before\n```mermaid\ngraph TD\n```\n'
    let state = stateWith(doc, 0)
    const block = mermaidBlocksToPreview(state)[0]!

    expect(mermaidDecorationRanges(state)).toEqual([{ from: block.from, to: block.to, kind: 'preview' }])

    state = state.update({ effects: pinMermaidSource.of({ from: block.from, to: block.to }) }).state
    expect(mermaidDecorationRanges(state)).toEqual([{ from: block.from, to: block.from, kind: 'source' }])
  })
})

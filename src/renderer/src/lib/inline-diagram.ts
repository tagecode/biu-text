import { syntaxTree } from '@codemirror/language'
import {
  EditorState,
  RangeSet,
  RangeSetBuilder,
  RangeValue,
  StateEffect,
  StateField,
  type Extension
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import type { Theme } from '@/hooks/useTheme'

export interface MermaidBlock {
  from: number
  to: number
  code: string
}

export interface InlineDiagramLabels {
  source: string
  preview: string
  renderFailed: string
}

export interface InlineDiagramOptions {
  theme: Theme
  labels: InlineDiagramLabels
}

class PinnedRange extends RangeValue {}

const pinnedMark = new PinnedRange()

export const pinMermaidSource = StateEffect.define<{ from: number; to: number }>({
  map: ({ from, to }, mapping) => ({ from: mapping.mapPos(from), to: mapping.mapPos(to) })
})

export const unpinMermaidSource = StateEffect.define<{ from: number; to: number }>({
  map: ({ from, to }, mapping) => ({ from: mapping.mapPos(from), to: mapping.mapPos(to) })
})

const pinnedField = StateField.define<RangeSet<PinnedRange>>({
  create() {
    return RangeSet.empty
  },
  update(set, transaction) {
    set = set.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(pinMermaidSource) && effect.value.from < effect.value.to) {
        set = set.update({ add: [pinnedMark.range(effect.value.from, effect.value.to)] })
      } else if (effect.is(unpinMermaidSource)) {
        const target = effect.value
        set = set.update({
          filter: (from, to) => from !== target.from || to !== target.to
        })
      }
    }
    return set
  }
})

export function listMermaidBlocks(state: EditorState): MermaidBlock[] {
  const blocks: MermaidBlock[] = []
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return
      let info = ''
      let code = ''
      for (let child = node.node.firstChild; child; child = child.nextSibling) {
        if (child.name === 'CodeInfo') info = state.sliceDoc(child.from, child.to)
        else if (child.name === 'CodeText') code = state.sliceDoc(child.from, child.to)
      }
      const lang = info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
      if (lang !== 'mermaid') return
      const from = state.doc.lineAt(node.from).from
      const to = state.doc.lineAt(Math.max(node.from, node.to - 1)).to
      blocks.push({ from, to, code })
    }
  })
  return blocks
}

/** 光标不在块内、且没有被钉成源码的 mermaid 围栏，才换成预览。 */
export function mermaidBlocksToPreview(state: EditorState): MermaidBlock[] {
  const pinned = state.field(pinnedField, false)
  return listMermaidBlocks(state).filter(
    (block) => !selectionHitsBlock(state, block.from, block.to) && !isPinned(pinned, block)
  )
}

/** 测试与插件共用：光标在块外时替换整块，钉住源码时只在块前放切换按钮。 */
export function mermaidDecorationRanges(
  state: EditorState
): Array<{ from: number; to: number; kind: 'preview' | 'source' }> {
  const ranges: Array<{ from: number; to: number; kind: 'preview' | 'source' }> = []
  buildMermaidDecorations(state, {
    theme: 'light',
    labels: { source: '源码', preview: '预览', renderFailed: '图表渲染失败' }
  }).between(0, state.doc.length, (from, to, decoration) => {
    ranges.push({
      from,
      to,
      kind: decoration.spec.widget instanceof MermaidSourceToggleWidget ? 'source' : 'preview'
    })
  })
  return ranges
}

export function inlineDiagrams(options: InlineDiagramOptions): Extension {
  return [
    pinnedField,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = buildMermaidDecorations(view.state, options)
        }

        update(update: ViewUpdate) {
          const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state)
          const pinChanged = update.startState.field(pinnedField) !== update.state.field(pinnedField)
          if (update.docChanged || update.selectionSet || treeChanged || pinChanged) {
            this.decorations = buildMermaidDecorations(update.state, options)
          }
        }
      },
      { decorations: (plugin) => plugin.decorations }
    )
  ]
}

function buildMermaidDecorations(state: EditorState, options: InlineDiagramOptions): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const pinned = state.field(pinnedField, false)
  for (const block of listMermaidBlocks(state)) {
    if (selectionHitsBlock(state, block.from, block.to)) continue
    if (isPinned(pinned, block)) {
      builder.add(
        block.from,
        block.from,
        Decoration.widget({
          widget: new MermaidSourceToggleWidget(options.labels),
          block: true,
          side: -1
        })
      )
      continue
    }
    builder.add(
      block.from,
      block.to,
      Decoration.replace({
        widget: new MermaidPreviewWidget(block.code, options.theme, options.labels),
        block: true
      })
    )
  }
  return builder.finish()
}

function isPinned(pinned: RangeSet<PinnedRange> | undefined, block: MermaidBlock): boolean {
  if (!pinned) return false
  let found = false
  pinned.between(block.from, block.to, (from, to) => {
    if (from <= block.from && to >= block.to) found = true
  })
  return found
}

function selectionHitsBlock(state: EditorState, from: number, to: number): boolean {
  const startLine = state.doc.lineAt(from).number
  const endLine = state.doc.lineAt(Math.max(from, to - 1)).number
  return state.selection.ranges.some((range) => {
    const head = state.doc.lineAt(Math.min(range.anchor, range.head)).number
    const anchor = state.doc.lineAt(Math.max(range.anchor, range.head)).number
    return head <= endLine && anchor >= startLine
  })
}

class MermaidPreviewWidget extends WidgetType {
  private abort: AbortController | null = null

  constructor(
    readonly code: string,
    readonly theme: Theme,
    readonly labels: InlineDiagramLabels
  ) {
    super()
  }

  eq(other: MermaidPreviewWidget): boolean {
    return other.code === this.code && other.theme === this.theme && sameLabels(other.labels, this.labels)
  }

  toDOM(): HTMLElement {
    this.abort?.abort()
    const abort = new AbortController()
    this.abort = abort

    const wrap = document.createElement('div')
    wrap.className = 'cm-inline-diagram'
    wrap.append(createToggleButton(this.labels.source, 'source'))

    const host = document.createElement('div')
    host.className = 'biu-diagram'
    host.dataset.diagramState = 'pending'
    host.append(createSource(this.code))
    wrap.append(host)

    void import('@/lib/diagram-hydrate')
      .then(({ renderDiagramSvg }) =>
        renderDiagramSvg({ id: 'inline', lang: 'mermaid', code: this.code }, this.theme)
      )
      .then((svg) => {
        if (abort.signal.aborted) return
        const svgHost = document.createElement('div')
        svgHost.className = 'biu-diagram-svg'
        svgHost.innerHTML = svg
        host.replaceChildren(svgHost)
        host.dataset.diagramState = 'ready'
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return
        const box = document.createElement('div')
        box.className = 'biu-diagram-error'
        box.textContent = this.labels.renderFailed
        const detail = document.createElement('code')
        detail.textContent = error instanceof Error ? error.message : String(error)
        box.append(detail)
        host.append(box)
        host.dataset.diagramState = 'error'
      })

    return wrap
  }

  destroy(): void {
    this.abort?.abort()
    this.abort = null
  }

  ignoreEvent(event: Event): boolean {
    if (!isPointerEvent(event)) return false
    if (event.type !== 'mousedown') return true
    const target = event.target
    if (!(target instanceof HTMLElement)) return true
    event.preventDefault()
    if (target.closest('[data-inline-diagram-toggle]')) dispatchBlockEffect(target, pinMermaidSource)
    else placeCursorInBlock(target)
    return true
  }
}

class MermaidSourceToggleWidget extends WidgetType {
  constructor(readonly labels: InlineDiagramLabels) {
    super()
  }

  eq(other: MermaidSourceToggleWidget): boolean {
    return other.labels.preview === this.labels.preview
  }

  toDOM(): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'cm-inline-diagram-bar'
    bar.append(createToggleButton(this.labels.preview, 'preview'))
    return bar
  }

  ignoreEvent(event: Event): boolean {
    if (!isPointerEvent(event)) return false
    if (event.type !== 'mousedown') return true
    const target = event.target
    if (!(target instanceof HTMLElement)) return true
    event.preventDefault()
    dispatchBlockEffect(target, unpinMermaidSource)
    return true
  }
}

function sameLabels(left: InlineDiagramLabels, right: InlineDiagramLabels): boolean {
  return left.source === right.source && left.preview === right.preview && left.renderFailed === right.renderFailed
}

function createSource(code: string): HTMLElement {
  const pre = document.createElement('pre')
  pre.className = 'biu-diagram-source'
  const node = document.createElement('code')
  node.textContent = code
  pre.append(node)
  return pre
}

function createToggleButton(label: string, mode: 'source' | 'preview'): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'cm-inline-diagram-toggle'
  button.dataset.inlineDiagramToggle = mode
  button.tabIndex = -1
  button.textContent = label
  return button
}

function isPointerEvent(event: Event): boolean {
  return event.type === 'mousedown' || event.type === 'mouseup' || event.type === 'click'
}

function dispatchBlockEffect(
  target: HTMLElement,
  effect: typeof pinMermaidSource | typeof unpinMermaidSource
): void {
  const view = EditorView.findFromDOM(target)
  if (!view) return
  const block = blockNear(view.state, view.posAtDOM(target))
  if (!block) return
  view.dispatch({ effects: effect.of({ from: block.from, to: block.to }) })
  view.focus()
}

function placeCursorInBlock(target: HTMLElement): void {
  const view = EditorView.findFromDOM(target)
  if (!view) return
  const block = blockNear(view.state, view.posAtDOM(target))
  view.dispatch({ selection: { anchor: block?.from ?? view.posAtDOM(target) } })
  view.focus()
}

function blockNear(state: EditorState, pos: number): MermaidBlock | undefined {
  const blocks = listMermaidBlocks(state)
  return (
    blocks.find((block) => pos >= block.from && pos <= block.to) ??
    blocks.find((block) => pos >= block.from - 1 && pos <= block.to + 1)
  )
}

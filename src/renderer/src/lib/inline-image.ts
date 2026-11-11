import { syntaxTree } from '@codemirror/language'
import { EditorState, RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { toPreviewImageSrc } from '@shared/image-url'

const REMOTE_IMAGE = /^https?:\/\//i
const DATA_IMAGE = /^data:image\//i
const UPLOADING_IMAGE = /^uploading:/i
const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const WINDOWS_ABS = /^[a-zA-Z]:[\\/]/

export interface InlineImage {
  from: number
  to: number
  alt: string
  src: string
  failed: boolean
}

export interface InlineImageOptions {
  documentPath: string | null
  errorLabel: string
}

/** 编辑器里允许直接加载的地址。相对路径交给自定义协议，其余危险地址只显示失败占位。 */
export function resolveEditorImageSrc(
  raw: string,
  documentPath: string | null
): { src: string; failed: boolean } {
  const trimmed = raw.trim()
  if (!trimmed) return { src: '', failed: true }
  if (REMOTE_IMAGE.test(trimmed) || DATA_IMAGE.test(trimmed)) return { src: trimmed, failed: false }
  if (
    EXPLICIT_SCHEME.test(trimmed) ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    WINDOWS_ABS.test(trimmed)
  ) {
    return { src: '', failed: true }
  }
  return { src: toPreviewImageSrc(trimmed, documentPath), failed: false }
}

export function listInlineImages(state: EditorState, documentPath: string | null): InlineImage[] {
  const images: InlineImage[] = []
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Image') return
      const parsed = readInlineImage(state, node.from, node.to, node.node)
      if (!parsed || UPLOADING_IMAGE.test(parsed.rawSrc)) return
      if (selectionHitsImage(state, node.from, node.to)) return
      const resolved = resolveEditorImageSrc(parsed.rawSrc, documentPath)
      images.push({
        from: node.from,
        to: node.to,
        alt: parsed.alt,
        src: resolved.src,
        failed: resolved.failed
      })
    }
  })
  return images
}

export function inlineImages(options: InlineImageOptions): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildInlineImageDecorations(view.state, options)
      }

      update(update: ViewUpdate) {
        const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state)
        if (update.docChanged || update.selectionSet || treeChanged) {
          this.decorations = buildInlineImageDecorations(update.state, options)
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )
}

function buildInlineImageDecorations(state: EditorState, options: InlineImageOptions): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const image of listInlineImages(state, options.documentPath)) {
    builder.add(
      image.from,
      image.to,
      Decoration.replace({
        widget: new InlineImageWidget(image.alt, image.src, image.failed, options.errorLabel)
      })
    )
  }
  return builder.finish()
}

function readInlineImage(
  state: EditorState,
  from: number,
  to: number,
  node: SyntaxNode
): { alt: string; rawSrc: string } | null {
  let rawSrc: string | null = null
  let inline = false
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const text = state.sliceDoc(child.from, child.to)
    if (child.name === 'URL') rawSrc = text
    if (child.name === 'LinkMark' && text === '(') inline = true
  }
  if (!inline) return null
  const alt = /^!\[([\s\S]*?)\]/.exec(state.sliceDoc(from, to))
  return { alt: alt?.[1] ?? '', rawSrc: rawSrc?.trim() ?? '' }
}

function selectionHitsImage(state: EditorState, from: number, to: number): boolean {
  const startLine = state.doc.lineAt(from).number
  const endLine = state.doc.lineAt(Math.max(from, to - 1)).number
  return state.selection.ranges.some((range) => {
    const head = state.doc.lineAt(Math.min(range.anchor, range.head)).number
    const anchor = state.doc.lineAt(Math.max(range.anchor, range.head)).number
    return head <= endLine && anchor >= startLine
  })
}

class InlineImageWidget extends WidgetType {
  private preview: HTMLElement | null = null

  constructor(
    readonly alt: string,
    readonly src: string,
    readonly failed: boolean,
    readonly errorLabel: string
  ) {
    super()
  }

  eq(other: InlineImageWidget): boolean {
    return (
      other.alt === this.alt &&
      other.src === this.src &&
      other.failed === this.failed &&
      other.errorLabel === this.errorLabel
    )
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-inline-image'
    if (this.failed || !this.src) {
      renderInlineImageError(wrap, this.errorLabel)
      return wrap
    }

    const img = document.createElement('img')
    img.className = 'cm-inline-image-thumb'
    img.alt = this.alt
    img.src = this.src
    img.draggable = false
    img.addEventListener('error', () => {
      this.hidePreview()
      img.remove()
      renderInlineImageError(wrap, this.errorLabel)
    })
    img.addEventListener('mouseenter', () => this.showPreview(img))
    img.addEventListener('mouseleave', () => this.hidePreview())
    wrap.append(img)
    return wrap
  }

  ignoreEvent(event: Event): boolean {
    if (event.type === 'mousedown') {
      placeCursorOnWidget(event)
      return true
    }
    return event.type === 'mouseenter' || event.type === 'mouseleave' || event.type === 'mousemove'
  }

  destroy(): void {
    this.hidePreview()
  }

  private showPreview(anchor: HTMLElement): void {
    this.hidePreview()
    const preview = document.createElement('span')
    preview.className = 'cm-inline-image-preview'
    preview.setAttribute('role', 'tooltip')
    const full = document.createElement('img')
    full.alt = this.alt
    full.src = this.src
    preview.append(full)
    document.body.append(preview)
    const place = () => positionPreview(preview, anchor.getBoundingClientRect())
    full.addEventListener('load', place)
    place()
    this.preview = preview
  }

  private hidePreview(): void {
    this.preview?.remove()
    this.preview = null
  }
}

function renderInlineImageError(wrap: HTMLElement, errorLabel: string): void {
  wrap.classList.add('cm-inline-image-error')
  wrap.setAttribute('role', 'img')
  wrap.setAttribute('aria-label', errorLabel)
  wrap.textContent = `🖼️ ${errorLabel}`
}

function placeCursorOnWidget(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  const view = EditorView.findFromDOM(target)
  if (!view) return
  const pos = view.posAtDOM(target)
  view.dispatch({ selection: { anchor: pos } })
  view.focus()
}

function positionPreview(preview: HTMLElement, rect: DOMRect): void {
  const margin = 8
  const height = preview.offsetHeight
  const width = preview.offsetWidth
  let top = rect.bottom + margin
  if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - margin - height)
  let left = rect.left
  if (left + width > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - margin - width)
  preview.style.top = `${top}px`
  preview.style.left = `${left}px`
}

import type { EditorView } from '@codemirror/view'

/**
 * 在光标处插入一段块级内容（图片链接、代码围栏等）。
 * 当前行还有其他文字时前后补换行，避免块内容接在段落末尾；
 * 一次只派发一条变更，撤销栈里也就一条记录。
 */
export function insertBlock(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const lineHasText = line.text.trim() !== ''
  const prefix = lineHasText && from > line.from ? '\n' : ''
  const suffix = lineHasText && to < line.to ? '\n' : ''
  const insert = `${prefix}${text}${suffix}`

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length }
  })
  view.focus()
}

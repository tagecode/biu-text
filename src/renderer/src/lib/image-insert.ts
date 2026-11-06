import type { EditorView } from '@codemirror/view'

function altFromPath(relativePath: string): string {
  const name = relativePath.split('/').pop() ?? relativePath
  return name.replace(/\.[^.]+$/, '')
}

/**
 * 在光标处插入图片引用。
 * 当前行还有其他文字时另起一行，避免把图片塞进段落中间；
 * 每次只派发一次变更，撤销栈里是一条记录。
 */
export function insertImageLinks(view: EditorView, relativePaths: string[]): void {
  if (relativePaths.length === 0) return

  const { from, to } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const lineHasText = line.text.trim() !== ''
  const prefix = lineHasText && from > line.from ? '\n' : ''
  const suffix = lineHasText && to < line.to ? '\n' : ''
  const snippet = relativePaths.map((path) => `![${altFromPath(path)}](${path})`).join('\n')
  const insert = `${prefix}${snippet}${suffix}`

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length }
  })
  view.focus()
}

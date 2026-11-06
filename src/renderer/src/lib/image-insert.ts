import type { EditorView } from '@codemirror/view'
import { insertBlock } from './block-insert'

function altFromPath(relativePath: string): string {
  const name = relativePath.split('/').pop() ?? relativePath
  return name.replace(/\.[^.]+$/, '')
}

/** 在光标处插入图片引用，多张图片各占一行 */
export function insertImageLinks(view: EditorView, relativePaths: string[]): void {
  if (relativePaths.length === 0) return
  insertBlock(
    view,
    relativePaths.map((path) => `![${altFromPath(path)}](${path})`).join('\n')
  )
}

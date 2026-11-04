import { EditorView } from '@codemirror/view'
import { openSearchPanel } from '@codemirror/search'

export function openReplacePanel(view: EditorView): boolean {
  const opened = openSearchPanel(view)
  const input = view.dom.querySelector<HTMLInputElement>('input[name="replace"]')
  if (input) {
    input.focus()
    input.select()
  }
  return opened
}

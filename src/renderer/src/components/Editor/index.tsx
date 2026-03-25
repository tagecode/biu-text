import { useCallback, useEffect, useRef, MutableRefObject } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import type { EditorFontFamily } from '@/hooks/useAppearanceSettings'
import type { Theme } from '@/hooks/useTheme'

interface EditorProps {
  content: string
  theme: Theme
  fontFamily: EditorFontFamily
  fontSize: number
  editorViewRef: MutableRefObject<EditorView | null>
  previewScrollRef: MutableRefObject<HTMLDivElement | null>
  onChange: (value: string) => void
  onCursorChange?: (line: number, col: number) => void
}

/** 在选中文字两侧包裹标记，若无选中则插入并定位光标 */
function wrapSelection(view: EditorView, before: string, after = before) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected) {
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: to + before.length }
    })
  } else {
    view.dispatch({
      changes: { from, insert: `${before}${after}` },
      selection: { anchor: from + before.length }
    })
  }
  view.focus()
}

/** 插入链接模板 */
function insertLink(view: EditorView) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const text = selected || '链接文字'
  const insert = `[${text}](url)`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + text.length + 3, head: from + text.length + 3 + 3 }
  })
  view.focus()
}

export function Editor({
  content,
  theme,
  fontFamily,
  fontSize,
  editorViewRef,
  previewScrollRef,
  onChange,
  onCursorChange
}: EditorProps) {
  const scrollSyncActive = useRef(false)

  const extensions = [
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
    // 格式化快捷键（优先级最高，防止被浏览器默认行为覆盖）
    Prec.highest(
      keymap.of([
        {
          key: 'Mod-b',
          run: (view) => { wrapSelection(view, '**'); return true }
        },
        {
          key: 'Mod-i',
          run: (view) => { wrapSelection(view, '*'); return true }
        },
        {
          key: 'Mod-`',
          run: (view) => { wrapSelection(view, '`'); return true }
        },
        {
          key: 'Mod-k',
          run: (view) => { insertLink(view); return true }
        }
      ])
    )
  ]

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      editorViewRef.current = view

      // 滚动同步：编辑区滚动 → 预览区同步
      view.scrollDOM.addEventListener('scroll', () => {
        if (scrollSyncActive.current) return
        const preview = previewScrollRef.current
        if (!preview) return
        const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM
        const maxScroll = scrollHeight - clientHeight
        if (maxScroll <= 0) return
        const pct = scrollTop / maxScroll
        scrollSyncActive.current = true
        preview.scrollTop = pct * (preview.scrollHeight - preview.clientHeight)
        requestAnimationFrame(() => {
          scrollSyncActive.current = false
        })
      })
    },
    [editorViewRef, previewScrollRef]
  )

  // 光标位置变化
  const handleUpdate = useCallback(
    (viewUpdate: Parameters<typeof CodeMirror>[0]['onUpdate'] extends ((vu: infer U) => void) | undefined ? U : never) => {
      if (!viewUpdate || !onCursorChange) return
      const pos = viewUpdate.state.selection.main.head
      const line = viewUpdate.state.doc.lineAt(pos)
      onCursorChange(line.number, pos - line.from + 1)
    },
    [onCursorChange]
  )

  return (
    <CodeMirror
      value={content}
      onChange={onChange}
      theme={theme === 'dark' ? oneDark : 'light'}
      extensions={extensions}
      onCreateEditor={handleCreateEditor}
      onUpdate={handleUpdate}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        bracketMatching: true,
        autocompletion: false,
        indentOnInput: true,
        syntaxHighlighting: true,
        searchKeymap: true,
        tabSize: 2
      }}
      style={
        {
          height: '100%',
          '--editor-font-family':
            fontFamily === 'fira-code'
              ? '"Fira Code", "JetBrains Mono", Menlo, Monaco, Consolas, monospace'
              : fontFamily === 'menlo'
                ? 'Menlo, Monaco, Consolas, "Courier New", monospace'
                : '"JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas, monospace',
          '--editor-font-size': `${fontSize}px`
        } as React.CSSProperties
      }
      className="h-full overflow-auto"
    />
  )
}

import { useCallback, useEffect, useMemo, useRef, useState, MutableRefObject } from 'react'
import type { ClipboardEvent, DragEvent } from 'react'
import i18n from '@/i18n'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap, placeholder } from '@codemirror/view'
import { EditorState, Prec } from '@codemirror/state'
import { search, openSearchPanel } from '@codemirror/search'
import { resolveLanguage } from '@shared/i18n/resolve-language'
import { searchPhrases } from '@shared/search-phrases'
import type { ImageFileInput } from '@shared/image-input'
import { openReplacePanel } from '@/lib/search-panel'
import { insertImageLinks } from '@/lib/image-insert'
import { inlineImages } from '@/lib/inline-image'
import { inlineDiagrams } from '@/lib/inline-diagram'
import { inlineTables } from '@/lib/inline-table'
import type { EditorFontFamily } from '@/hooks/useAppearanceSettings'
import type { Theme } from '@/hooks/useTheme'

interface EditorProps {
  /** 每个标签一个编辑器实例，用文档 id 区分 */
  documentId: string
  content: string
  theme: Theme
  fontFamily: EditorFontFamily
  fontSize: number
  tabWidth: number
  lineHeight: number
  showLineNumbers: boolean
  inlineRender: boolean
  documentPath: string | null
  previewScrollRef: MutableRefObject<HTMLDivElement | null>
  onChange: (value: string) => void
  onCursorChange?: (line: number, col: number) => void
  /** 滚动位置回传：标签切走时 display:none 会丢掉 scrollTop，上层据此恢复 */
  onScroll?: (scrollTop: number) => void
  /** 把图片字节交给主进程落盘，返回可写进 Markdown 的相对路径 */
  onImageFiles?: (files: ImageFileInput[]) => Promise<string[]>
  /** 编辑器实例就绪/销毁时通知上层，供工具栏与菜单动作定位到活动标签 */
  onViewReady?: (documentId: string, view: EditorView) => void
  onViewDestroy?: (documentId: string) => void
}

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_NAME.test(file.name)
}

async function toImageInputs(files: File[]): Promise<ImageFileInput[]> {
  return Promise.all(
    files.map(async (file) => ({
      bytes: await file.arrayBuffer(),
      name: file.name,
      mime: file.type
    }))
  )
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
function insertLink(view: EditorView, linkText: string) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const text = selected || linkText
  const insert = `[${text}](url)`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + text.length + 3, head: from + text.length + 3 + 3 }
  })
  view.focus()
}

export function Editor({
  documentId,
  content,
  theme,
  fontFamily,
  fontSize,
  tabWidth,
  lineHeight,
  showLineNumbers,
  inlineRender,
  documentPath,
  previewScrollRef,
  onChange,
  onCursorChange,
  onScroll,
  onImageFiles,
  onViewReady,
  onViewDestroy
}: EditorProps) {
  const scrollSyncActive = useRef(false)
  const viewRef = useRef<EditorView | null>(null)
  // 滚动监听在创建时注册一次，用 ref 拿最新的回调，避免闭包里的旧函数
  const onScrollRef = useRef(onScroll)
  useEffect(() => {
    onScrollRef.current = onScroll
  }, [onScroll])
  const [dragActive, setDragActive] = useState(false)

  const language = resolveLanguage(i18n.language, i18n.language)
  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
    indentUnit.of(' '.repeat(tabWidth)),
    placeholder(i18n.t('editor.placeholder')),
    EditorState.phrases.of(searchPhrases(language)),
    // 显式启用搜索扩展，支持替换与正则/大小写/全词选项
    search({ top: true }),
    // 格式化快捷键（优先级最高，防止被浏览器默认行为覆盖）
    Prec.highest(
      keymap.of([
        {
          key: 'Mod-f',
          run: (view) => openSearchPanel(view)
        },
        {
          key: 'Mod-h',
          run: (view) => openReplacePanel(view)
        },
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
          run: (view) => {
            insertLink(view, i18n.t('editor.linkText'))
            return true
          }
        }
      ])
    ),
    ...(inlineRender
      ? [
          inlineImages({ documentPath, errorLabel: i18n.t('image.inlineFailed') }),
          inlineDiagrams({
            theme,
            labels: {
              source: i18n.t('diagram.showSource'),
              preview: i18n.t('diagram.showPreview'),
              renderFailed: i18n.t('diagram.renderFailed')
            }
          }),
          inlineTables({ label: i18n.t('editor.inlineTable') })
        ]
      : [])
  ], [tabWidth, language, inlineRender, documentPath, theme])

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      viewRef.current = view
      onViewReady?.(documentId, view)

      // 滚动同步：编辑区滚动 → 预览区同步
      view.scrollDOM.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM
        onScrollRef.current?.(scrollTop)
        if (scrollSyncActive.current) return
        const preview = previewScrollRef.current
        if (!preview) return
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
    [documentId, onViewReady, previewScrollRef]
  )

  // 标签关掉后把实例从上层登记表里摘掉，避免 ref 指向已卸载的编辑器
  useEffect(() => {
    return () => {
      viewRef.current = null
      onViewDestroy?.(documentId)
    }
  }, [documentId, onViewDestroy])

  const insertImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || !onImageFiles) return
      const paths = await onImageFiles(await toImageInputs(files))
      const view = viewRef.current
      if (view && paths.length > 0) insertImageLinks(view, paths)
    },
    [onImageFiles]
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const items = event.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of Array.from(items)) {
        if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (file) files.push(file)
      }
      if (files.length === 0) return
      // 在捕获阶段拦下，避免 CodeMirror 再把剪贴板里的文本内容插一遍
      event.preventDefault()
      event.stopPropagation()
      void insertImages(files)
    },
    [insertImages]
  )

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragActive(false)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      setDragActive(false)
      const files = Array.from(event.dataTransfer.files ?? [])
      // 没有文件说明是文本拖放，留给 CodeMirror 自己处理
      if (files.length === 0) return
      event.preventDefault()
      void insertImages(files.filter(isImageFile))
    },
    [insertImages]
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
    <div
      className="relative h-full"
      onPasteCapture={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CodeMirror
        value={content}
        onChange={onChange}
        theme={theme === 'dark' ? oneDark : 'light'}
        extensions={extensions}
        onCreateEditor={handleCreateEditor}
        onUpdate={handleUpdate}
        basicSetup={{
          lineNumbers: showLineNumbers,
          foldGutter: false,
          highlightActiveLine: true,
          bracketMatching: true,
          autocompletion: false,
          indentOnInput: true,
          syntaxHighlighting: true,
          searchKeymap: true,
          tabSize: tabWidth
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
            '--editor-font-size': `${fontSize}px`,
            '--editor-line-height': String(lineHeight)
          } as React.CSSProperties
        }
        className="h-full overflow-auto"
      />
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-background/70">
          <span className="text-sm font-medium text-primary">{i18n.t('image.insert')}</span>
        </div>
      )}
    </div>
  )
}

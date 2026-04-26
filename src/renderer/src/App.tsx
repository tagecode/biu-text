import { useRef, useState, useCallback, useEffect } from 'react'
import { EditorView } from '@codemirror/view'
import { Editor } from '@/components/Editor'
import { Preview } from '@/components/Preview'
import { Toolbar } from '@/components/Toolbar'
import { Splitter } from '@/components/Splitter'
import { StatusBar } from '@/components/StatusBar'
import { SettingsPanel } from '@/components/SettingsPanel'
import { useFile } from '@/hooks/useFile'
import { useTheme } from '@/hooks/useTheme'
import { useAppearanceSettings } from '@/hooks/useAppearanceSettings'
import { useWordCount } from '@/hooks/useWordCount'
import { buildExportHtmlDocument } from '@/lib/export-document'

// ─── Editor formatting helpers ───────────────────────────────────
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

// ─── Layout constants ────────────────────────────────────────────
const DEFAULT_LEFT_PCT = 50
const MIN_LEFT_PCT = 20
const MAX_LEFT_PCT = 80
const SPLITTER_STORAGE_KEY = 'biu-text:splitter-left-pct'
const PREVIEW_VISIBLE_STORAGE_KEY = 'biu-text:preview-visible'

function readStoredLeftPct(): number {
  try {
    const raw = localStorage.getItem(SPLITTER_STORAGE_KEY)
    if (raw === null) return DEFAULT_LEFT_PCT
    const val = parseFloat(raw)
    return isFinite(val) ? Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, val)) : DEFAULT_LEFT_PCT
  } catch {
    return DEFAULT_LEFT_PCT
  }
}

function readStoredPreviewVisible(): boolean {
  try {
    const raw = localStorage.getItem(PREVIEW_VISIBLE_STORAGE_KEY)
    if (raw === null) return true
    return raw === 'true'
  } catch {
    return true
  }
}

// ─── App ─────────────────────────────────────────────────────────
function App() {
  const { content, filePath, setContent, newFile, openFile, saveFile, exportHtml, exportPdf } = useFile()
  const { theme, themeMode, setThemeMode, cycleThemeMode } = useTheme()
  const {
    editorFontFamily,
    previewFontFamily,
    fontSize,
    previewTheme,
    setEditorFontFamily,
    setPreviewFontFamily,
    setFontSize,
    setPreviewTheme
  } = useAppearanceSettings()
  const wordCount = useWordCount(content)

  const editorViewRef = useRef<EditorView | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [leftPercent, setLeftPercent] = useState(readStoredLeftPct)
  const [previewVisible, setPreviewVisible] = useState(readStoredPreviewVisible)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorCol, setCursorCol] = useState(1)

  // ── Splitter ────────────────────────────────────────────────────
  const handleSplitterDrag = useCallback((deltaX: number) => {
    const width = containerRef.current?.clientWidth ?? 0
    if (width === 0) return
    setLeftPercent((prev) => {
      const next = Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, prev + (deltaX / width) * 100))
      localStorage.setItem(SPLITTER_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const handleSplitterReset = useCallback(() => {
    setLeftPercent(DEFAULT_LEFT_PCT)
    localStorage.setItem(SPLITTER_STORAGE_KEY, String(DEFAULT_LEFT_PCT))
  }, [])

  const handleTogglePreviewVisible = useCallback(() => {
    setPreviewVisible((prev) => {
      const next = !prev
      localStorage.setItem(PREVIEW_VISIBLE_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  // ── Cursor ──────────────────────────────────────────────────────
  const handleCursorChange = useCallback((line: number, col: number) => {
    setCursorLine(line)
    setCursorCol(col)
  }, [])

  // ── Toolbar format buttons ──────────────────────────────────────
  const handleBold = useCallback(() => {
    if (editorViewRef.current) wrapSelection(editorViewRef.current, '**')
  }, [])

  const handleItalic = useCallback(() => {
    if (editorViewRef.current) wrapSelection(editorViewRef.current, '*')
  }, [])

  const handleCode = useCallback(() => {
    if (editorViewRef.current) wrapSelection(editorViewRef.current, '`')
  }, [])

  const handleLink = useCallback(() => {
    if (editorViewRef.current) insertLink(editorViewRef.current)
  }, [])

  const getExportTitle = useCallback(() => {
    if (!filePath) return 'BiuText 文档'
    const normalized = filePath.replaceAll('\\', '/')
    return normalized.split('/').pop() ?? 'BiuText 文档'
  }, [filePath])

  const handleExportHtml = useCallback(async () => {
    const html = buildExportHtmlDocument({
      title: getExportTitle(),
      content,
      theme,
      previewTheme,
      previewFontFamily,
      fontSize
    })
    await exportHtml(html)
  }, [content, theme, previewTheme, previewFontFamily, fontSize, getExportTitle, exportHtml])

  const handleExportPdf = useCallback(async () => {
    const html = buildExportHtmlDocument({
      title: getExportTitle(),
      content,
      theme,
      previewTheme,
      previewFontFamily,
      fontSize
    })
    await exportPdf(html)
  }, [content, theme, previewTheme, previewFontFamily, fontSize, getExportTitle, exportPdf])

  useEffect(() => {
    const unsubExportHtml = window.fileAPI.onMenuExportHtml(() => {
      void handleExportHtml()
    })
    const unsubExportPdf = window.fileAPI.onMenuExportPdf(() => {
      void handleExportPdf()
    })
    return () => {
      unsubExportHtml()
      unsubExportPdf()
    }
  }, [handleExportHtml, handleExportPdf])

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <Toolbar
        themeMode={themeMode}
        wordCount={wordCount}
        onNewFile={newFile}
        onOpenFile={openFile}
        onSaveFile={saveFile}
        onExportHtml={handleExportHtml}
        onExportPdf={handleExportPdf}
        previewVisible={previewVisible}
        onTogglePreviewVisible={handleTogglePreviewVisible}
        onOpenSettings={() => setSettingsOpen(true)}
        onBold={handleBold}
        onItalic={handleItalic}
        onCode={handleCode}
        onLink={handleLink}
      />

      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
        {/* 左侧编辑区 */}
        <div style={{ width: previewVisible ? `${leftPercent}%` : '100%' }} className="min-w-0 overflow-hidden">
          <Editor
            content={content}
            theme={theme}
            fontFamily={editorFontFamily}
            fontSize={fontSize}
            editorViewRef={editorViewRef}
            previewScrollRef={previewScrollRef}
            onChange={setContent}
            onCursorChange={handleCursorChange}
          />
        </div>

        {previewVisible && (
          <>
            <Splitter onDrag={handleSplitterDrag} onReset={handleSplitterReset} />

            {/* 右侧预览区 */}
            <div style={{ width: `${100 - leftPercent}%` }} className="min-w-0 overflow-hidden">
              <Preview
                ref={previewScrollRef}
                content={content}
                theme={theme}
                previewTheme={previewTheme}
                previewFontFamily={previewFontFamily}
                fontSize={fontSize}
              />
            </div>
          </>
        )}
      </div>

      <StatusBar
        line={cursorLine}
        col={cursorCol}
        wordCount={wordCount}
        theme={theme}
        themeMode={themeMode}
        previewTheme={previewTheme}
        fontSize={fontSize}
        onCycleThemeMode={cycleThemeMode}
      />

      <SettingsPanel
        open={settingsOpen}
        themeMode={themeMode}
        editorFontFamily={editorFontFamily}
        previewFontFamily={previewFontFamily}
        fontSize={fontSize}
        previewTheme={previewTheme}
        onClose={() => setSettingsOpen(false)}
        onThemeModeChange={setThemeMode}
        onEditorFontFamilyChange={setEditorFontFamily}
        onPreviewFontFamilyChange={setPreviewFontFamily}
        onFontSizeChange={setFontSize}
        onPreviewThemeChange={setPreviewTheme}
      />
    </div>
  )
}

export default App

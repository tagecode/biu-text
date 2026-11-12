import { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorView } from '@codemirror/view'
import { openSearchPanel } from '@codemirror/search'
import { openReplacePanel } from '@/lib/search-panel'
import { Editor } from '@/components/Editor'
import { Preview } from '@/components/Preview'
import { Toolbar } from '@/components/Toolbar'
import { Splitter } from '@/components/Splitter'
import { StatusBar } from '@/components/StatusBar'
import { SettingsPanel } from '@/components/SettingsPanel'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/Toaster'
import { UploadIndicator } from '@/components/UploadIndicator'
import { useFile } from '@/hooks/useFile'
import { useTheme } from '@/hooks/useTheme'
import { useAppearanceSettings } from '@/hooks/useAppearanceSettings'
import { useLoginItem } from '@/hooks/useLoginItem'
import { useWordCount } from '@/hooks/useWordCount'
import { useNotifications } from '@/hooks/useNotifications'
import { useImageHost } from '@/hooks/useImageHost'
import { useImageUpload } from '@/hooks/useImageUpload'
import { ExportPreview, type ExportIntent } from '@/components/ExportPreview'
import { insertImageLinks } from '@/lib/image-insert'
import { insertBlock } from '@/lib/block-insert'
import { MERMAID_SNIPPET } from '@shared/diagram'
import type { ImageFileInput } from '@shared/image-input'

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
  const { t } = useTranslation()
  useNotifications()
  const { content, filePath, setContent, updateContent, newFile, openFile, saveFile, saveDocument, autoSave, exportHtml, exportPdf } =
    useFile()
  const { theme, themeMode, setThemeMode, cycleThemeMode } = useTheme()
  const {
    editorFontFamily,
    previewFontFamily,
    fontSize,
    previewTheme,
    tabWidth,
    lineHeight,
    showLineNumbers,
    inlineRender,
    autoSaveSeconds,
    setEditorFontFamily,
    setPreviewFontFamily,
    setFontSize,
    setPreviewTheme,
    setTabWidth,
    setLineHeight,
    setShowLineNumbers,
    setInlineRender,
    setAutoSaveSeconds
  } = useAppearanceSettings()
  const { openAtLogin, setOpenAtLogin } = useLoginItem()
  const wordCount = useWordCount(content)

  const editorViewRef = useRef<EditorView | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // 重试上传前需要判断占位符是否还在文档里，这里始终指向最新内容
  const contentRef = useRef(content)
  useEffect(() => {
    contentRef.current = content
  }, [content])

  const { config: imageHost, saveConfig: saveImageHost } = useImageHost()
  const { startUpload, isCloud } = useImageUpload({
    hostType: imageHost?.type ?? 'local',
    insertPlaceholders: (text) => {
      if (editorViewRef.current) insertBlock(editorViewRef.current, text)
    },
    updateContent,
    getContent: () => contentRef.current
  })

  const [leftPercent, setLeftPercent] = useState(readStoredLeftPct)
  const [previewVisible, setPreviewVisible] = useState(readStoredPreviewVisible)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportIntent, setExportIntent] = useState<ExportIntent | null>(null)
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

  useEffect(() => {
    if (autoSaveSeconds <= 0) return
    const timer = window.setInterval(() => {
      void autoSave()
    }, autoSaveSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [autoSaveSeconds, autoSave])

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
    if (editorViewRef.current) insertLink(editorViewRef.current, t('editor.linkText'))
  }, [t])

  // 本地模式写进文档同目录的 assets/；云图床模式先插占位符，上传完成后回填 URL
  const handleImageFiles = useCallback(
    async (files: ImageFileInput[]): Promise<string[]> => {
      if (isCloud) {
        startUpload(files)
        return []
      }
      const path = await saveDocument()
      if (!path) return []
      return window.imageAPI.saveImages(path, files)
    },
    [isCloud, startUpload, saveDocument]
  )

  const handleInsertImage = useCallback(async () => {
    if (isCloud) {
      startUpload(await window.imageAPI.pickImageInputs())
      return
    }
    const path = await saveDocument()
    if (!path) return
    const paths = await window.imageAPI.pickImages(path)
    const view = editorViewRef.current
    if (view && paths.length > 0) insertImageLinks(view, paths)
  }, [isCloud, startUpload, saveDocument])

  const handleInsertDiagram = useCallback(() => {
    if (editorViewRef.current) insertBlock(editorViewRef.current, MERMAID_SNIPPET)
  }, [])

  const getExportTitle = useCallback(() => {
    if (!filePath) return t('app.document')
    const normalized = filePath.replaceAll('\\', '/')
    return normalized.split('/').pop() ?? t('app.document')
  }, [filePath, t])

  const handleExportHtml = useCallback(() => {
    setExportIntent('html')
  }, [])

  const handleExportPdf = useCallback(() => {
    setExportIntent('pdf')
  }, [])

  useEffect(() => {
    const unsubExportHtml = window.fileAPI.onMenuExportHtml(() => {
      void handleExportHtml()
    })
    const unsubExportPdf = window.fileAPI.onMenuExportPdf(() => {
      void handleExportPdf()
    })
    const unsubFind = window.fileAPI.onMenuFind(() => {
      if (editorViewRef.current) openSearchPanel(editorViewRef.current)
    })
    const unsubReplace = window.fileAPI.onMenuReplace(() => {
      if (editorViewRef.current) openReplacePanel(editorViewRef.current)
    })
    return () => {
      unsubExportHtml()
      unsubExportPdf()
      unsubFind()
      unsubReplace()
    }
  }, [handleExportHtml, handleExportPdf])

  // ── Render ──────────────────────────────────────────────────────
  return (
    <TooltipProvider>
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
          onInsertImage={handleInsertImage}
          onInsertDiagram={handleInsertDiagram}
        />

        <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧编辑区 */}
          <div style={{ width: previewVisible ? `${leftPercent}%` : '100%' }} className="min-w-0 overflow-hidden">
            <Editor
              content={content}
              theme={theme}
              fontFamily={editorFontFamily}
              fontSize={fontSize}
              tabWidth={tabWidth}
              lineHeight={lineHeight}
              showLineNumbers={showLineNumbers}
              inlineRender={inlineRender}
              documentPath={filePath}
              editorViewRef={editorViewRef}
              previewScrollRef={previewScrollRef}
              onChange={setContent}
              onCursorChange={handleCursorChange}
              onImageFiles={handleImageFiles}
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
                  documentPath={filePath}
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
          tabWidth={tabWidth}
          lineHeight={lineHeight}
          showLineNumbers={showLineNumbers}
          inlineRender={inlineRender}
          autoSaveSeconds={autoSaveSeconds}
          openAtLogin={openAtLogin}
          imageHost={imageHost}
          onSaveImageHost={saveImageHost}
          onClose={() => setSettingsOpen(false)}
          onThemeModeChange={setThemeMode}
          onEditorFontFamilyChange={setEditorFontFamily}
          onPreviewFontFamilyChange={setPreviewFontFamily}
          onFontSizeChange={setFontSize}
          onPreviewThemeChange={setPreviewTheme}
          onTabWidthChange={setTabWidth}
          onLineHeightChange={setLineHeight}
          onShowLineNumbersChange={setShowLineNumbers}
          onInlineRenderChange={setInlineRender}
          onAutoSaveSecondsChange={setAutoSaveSeconds}
          onOpenAtLoginChange={(value) => {
            void setOpenAtLogin(value)
          }}
        />
        <ExportPreview
          open={exportIntent !== null}
          intent={exportIntent ?? 'html'}
          content={content}
          documentPath={filePath}
          title={getExportTitle()}
          theme={theme}
          previewTheme={previewTheme}
          previewFontFamily={previewFontFamily}
          fontSize={fontSize}
          onClose={() => setExportIntent(null)}
          onExportHtml={exportHtml}
          onExportPdf={exportPdf}
        />
        <Toaster />
        <UploadIndicator />
      </div>
    </TooltipProvider>
  )
}

export default App

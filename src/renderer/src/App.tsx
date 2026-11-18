import { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorView } from '@codemirror/view'
import { openSearchPanel } from '@codemirror/search'
import { openReplacePanel } from '@/lib/search-panel'
import { Editor } from '@/components/Editor'
import { Preview } from '@/components/Preview'
import { TabBar } from '@/components/TabBar'
import { FileTree } from '@/components/FileTree'
import { Toolbar } from '@/components/Toolbar'
import { Splitter } from '@/components/Splitter'
import { StatusBar } from '@/components/StatusBar'
import { SettingsPanel } from '@/components/SettingsPanel'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/Toaster'
import { UploadIndicator } from '@/components/UploadIndicator'
import { useDocuments } from '@/hooks/useDocuments'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useTheme } from '@/hooks/useTheme'
import { useAppearanceSettings } from '@/hooks/useAppearanceSettings'
import { useLoginItem } from '@/hooks/useLoginItem'
import { useWordCount } from '@/hooks/useWordCount'
import { useDebounce } from '@/hooks/useDebounce'
import { useNotifications } from '@/hooks/useNotifications'
import { useImageHost } from '@/hooks/useImageHost'
import { useImageUpload } from '@/hooks/useImageUpload'
import { ExportPreview, type ExportIntent } from '@/components/ExportPreview'
import { ExcalidrawEditor } from '@/components/ExcalidrawEditor'
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
const SIDEBAR_VISIBLE_STORAGE_KEY = 'biu-text:sidebar-visible'

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

/**
 * 侧边栏显示偏好。
 *
 * 三态很重要：`null` 表示**没有明确偏好**（旧版本升上来、或 localStorage 被清过），
 * 与用户主动收起（`false`）不是一回事——恢复出文件夹时前者应当默认展开。
 */
function readStoredSidebarPreference(): boolean | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_VISIBLE_STORAGE_KEY)
    if (raw === null) return null
    return raw === 'true'
  } catch {
    return null
  }
}

function writeStoredSidebarVisible(visible: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_VISIBLE_STORAGE_KEY, String(visible))
  } catch {
    // 配额或隐私模式下写不进去不影响使用
  }
}

// ─── App ─────────────────────────────────────────────────────────
function App() {
  const { t } = useTranslation()
  useNotifications()
  const {
    documents,
    activeId,
    activeDocument,
    setContent,
    updateContent,
    getContent,
    setCursor,
    activate,
    activateIndex,
    newDocument,
    openFile,
    openPath,
    saveFile,
    saveDocument,
    autoSave,
    closeDocument,
    renamePath,
    closeByPath,
    isPathDirty,
    exportHtml,
    exportPdf
  } = useDocuments()
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

  const content = activeDocument.content
  const filePath = activeDocument.filePath
  // 字数统计要扫全文，不值得每个按键都算；200ms 的延迟对读数字毫无影响
  const wordCount = useWordCount(useDebounce(content, 200))

  // 每个标签一个 CodeMirror 实例；这里只登记可见（已挂载）的那几个
  const viewsRef = useRef(new Map<string, EditorView>())
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // 标签切走时 display:none 会丢掉滚动位置，先记下来再恢复
  const editorScrollRef = useRef(new Map<string, number>())

  const activeView = useCallback(
    () => viewsRef.current.get(activeId) ?? null,
    [activeId]
  )

  const handleViewReady = useCallback((docId: string, view: EditorView) => {
    viewsRef.current.set(docId, view)
  }, [])

  const handleViewDestroy = useCallback((docId: string) => {
    viewsRef.current.delete(docId)
  }, [])

  const { config: imageHost, saveConfig: saveImageHost } = useImageHost()
  const { startUpload, isCloud } = useImageUpload({
    hostType: imageHost?.type ?? 'local',
    insertPlaceholders: (docId, text) => {
      const view = viewsRef.current.get(docId)
      if (view) insertBlock(view, text)
    },
    updateContent,
    getContent
  })

  const [leftPercent, setLeftPercent] = useState(readStoredLeftPct)
  const [previewVisible, setPreviewVisible] = useState(readStoredPreviewVisible)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportIntent, setExportIntent] = useState<ExportIntent | null>(null)
  const [drawingOpen, setDrawingOpen] = useState(false)
  // 启动时先收起：等恢复出上次的文件夹（或用户主动打开/切换）再显示，
  // 否则会出现一个没有文件夹的空侧边栏
  const [sidebarVisible, setSidebarVisible] = useState(false)

  const handleWorkspaceRestored = useCallback(() => {
    // 恢复出上次的文件夹：优先尊重记住的显示状态；没有明确偏好时默认展开
    setSidebarVisible(readStoredSidebarPreference() !== false)
  }, [])

  const {
    root: workspaceRoot,
    entries: workspaceEntries,
    loading: workspaceLoading,
    openFolder: openWorkspaceFolder,
    refresh: refreshWorkspace,
    closeFolder: closeWorkspaceFolder,
    rename: renameWorkspaceEntry,
    remove: removeWorkspaceEntry,
    openFile: openWorkspaceFile
  } = useWorkspace({
    onOpenFile: (path) => {
      void openPath(path)
    },
    onRenamed: renamePath,
    onDeleted: closeByPath,
    isDirty: isPathDirty,
    onRestored: handleWorkspaceRestored
  })

  const handleOpenWorkspaceFolder = useCallback(async () => {
    const opened = await openWorkspaceFolder()
    if (!opened) return
    // 刚打开文件夹，用户一定想看到它：显式收起过的偏好也在这里让位
    setSidebarVisible(true)
    writeStoredSidebarVisible(true)
  }, [openWorkspaceFolder])

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible((prev) => {
      const next = !prev
      writeStoredSidebarVisible(next)
      return next
    })
  }, [])

  const handleOpenWorkspaceFile = useCallback(
    (path: string) => {
      openWorkspaceFile(path)
    },
    [openWorkspaceFile]
  )

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

  // ── 标签切换 ────────────────────────────────────────────────────
  // 滚动位置由编辑器持续回传（见 handleEditorScroll），切换时只需换 activeId，
  // 这样点击标签、⌘1-9、新建/打开/关闭等所有切换路径行为一致
  const handleActivateTab = useCallback(
    (docId: string) => {
      if (docId === activeId) return
      activate(docId)
    },
    [activate, activeId]
  )

  const handleEditorScroll = useCallback((docId: string, scrollTop: number) => {
    editorScrollRef.current.set(docId, scrollTop)
  }, [])

  // 切回已挂载的标签时补一次测量与滚动恢复：隐藏期间浏览器不保留 scrollTop
  useEffect(() => {
    const storedTop = editorScrollRef.current.get(activeId) ?? 0
    const frame = requestAnimationFrame(() => {
      const view = viewsRef.current.get(activeId)
      if (!view) return
      view.requestMeasure()
      view.scrollDOM.scrollTop = storedTop
      const preview = previewScrollRef.current
      if (!preview) return
      const maxEditor = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight
      const maxPreview = preview.scrollHeight - preview.clientHeight
      if (maxEditor > 0 && maxPreview > 0) {
        preview.scrollTop = (view.scrollDOM.scrollTop / maxEditor) * maxPreview
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [activeId])

  // ⌘1-9 / Ctrl+1-9 切换标签，第 9 个固定落最后一个标签
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      // 只认顶排数字键：/^[1-9]$/ 没有捕获组，直接对 event.key 取值
      if (!/^[1-9]$/.test(event.key)) return
      event.preventDefault()
      activateIndex(Number(event.key) - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activateIndex])

  const handleCloseTab = useCallback(
    (docId: string) => {
      void closeDocument(docId)
    },
    [closeDocument]
  )

  // ── Toolbar format buttons ──────────────────────────────────────
  const handleBold = useCallback(() => {
    const view = activeView()
    if (view) wrapSelection(view, '**')
  }, [activeView])

  const handleItalic = useCallback(() => {
    const view = activeView()
    if (view) wrapSelection(view, '*')
  }, [activeView])

  const handleCode = useCallback(() => {
    const view = activeView()
    if (view) wrapSelection(view, '`')
  }, [activeView])

  const handleLink = useCallback(() => {
    const view = activeView()
    if (view) insertLink(view, t('editor.linkText'))
  }, [activeView, t])

  // 本地模式写进文档同目录的 assets/；云图床模式先插占位符，上传完成后回填 URL
  const handleImageFiles = useCallback(
    async (docId: string, files: ImageFileInput[]): Promise<string[]> => {
      if (isCloud) {
        startUpload(docId, files)
        return []
      }
      const path = await saveDocument(docId)
      if (!path) return []
      return window.imageAPI.saveImages(path, files)
    },
    [isCloud, startUpload, saveDocument]
  )

  const handleInsertImage = useCallback(async () => {
    const docId = activeId
    if (isCloud) {
      startUpload(docId, await window.imageAPI.pickImageInputs())
      return
    }
    const path = await saveDocument(docId)
    if (!path) return
    const paths = await window.imageAPI.pickImages(path)
    const view = viewsRef.current.get(docId)
    if (view && paths.length > 0) insertImageLinks(view, paths)
  }, [activeId, isCloud, startUpload, saveDocument])

  const handleInsertDiagram = useCallback(() => {
    const view = activeView()
    if (view) insertBlock(view, MERMAID_SNIPPET)
  }, [activeView])

  // 手绘图的代码块由对话框生成，这里只负责插到光标处
  const handleInsertDrawing = useCallback(
    (block: string) => {
      const view = activeView()
      if (view) insertBlock(view, block)
    },
    [activeView]
  )

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
      const view = activeView()
      if (view) openSearchPanel(view)
    })
    const unsubReplace = window.fileAPI.onMenuReplace(() => {
      const view = activeView()
      if (view) openReplacePanel(view)
    })
    return () => {
      unsubExportHtml()
      unsubExportPdf()
      unsubFind()
      unsubReplace()
    }
  }, [handleExportHtml, handleExportPdf, activeView])

  // 文件 → 打开文件夹…
  useEffect(
    () =>
      window.fileAPI.onMenuOpenFolder(() => {
        void handleOpenWorkspaceFolder()
      }),
    [handleOpenWorkspaceFolder]
  )

  // ── Render ──────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
        <Toolbar
          themeMode={themeMode}
          wordCount={wordCount}
          onNewFile={newDocument}
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
          onInsertDrawing={() => setDrawingOpen(true)}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={handleToggleSidebar}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {sidebarVisible && (
            <div className="w-60 shrink-0">
              <FileTree
                root={workspaceRoot}
                entries={workspaceEntries}
                loading={workspaceLoading}
                activePath={filePath}
                onOpenFile={handleOpenWorkspaceFile}
                onOpenFolder={() => void handleOpenWorkspaceFolder()}
                onRefresh={() => void refreshWorkspace()}
                onCloseFolder={closeWorkspaceFolder}
                onRename={renameWorkspaceEntry}
                onRemove={removeWorkspaceEntry}
              />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* 标签栏属于"编辑区这一列"：文件树要一直顶到工具栏下方 */}
            <TabBar
              documents={documents}
              activeId={activeId}
              onActivate={handleActivateTab}
              onClose={handleCloseTab}
              onNew={newDocument}
            />

            <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
              {/* 左侧编辑区：每个标签一个实例，只有活动的那个参与布局 */}
              <div style={{ width: previewVisible ? `${leftPercent}%` : '100%' }} className="min-w-0 overflow-hidden">
                <div className="h-full">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="h-full"
                      style={{ display: doc.id === activeId ? 'block' : 'none' }}
                    >
                      <Editor
                        documentId={doc.id}
                        content={doc.content}
                        theme={theme}
                        fontFamily={editorFontFamily}
                        fontSize={fontSize}
                        tabWidth={tabWidth}
                        lineHeight={lineHeight}
                        showLineNumbers={showLineNumbers}
                        inlineRender={inlineRender}
                        documentPath={doc.filePath}
                        previewScrollRef={previewScrollRef}
                        onChange={(value) => setContent(doc.id, value)}
                        onCursorChange={(line, col) => setCursor(doc.id, line, col)}
                        onScroll={(top) => handleEditorScroll(doc.id, top)}
                        onImageFiles={(files) => handleImageFiles(doc.id, files)}
                        onViewReady={handleViewReady}
                        onViewDestroy={handleViewDestroy}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {previewVisible && (
                <>
                  <Splitter onDrag={handleSplitterDrag} onReset={handleSplitterReset} />

                  {/* 右侧预览区：只渲染活动标签 */}
                  <div style={{ width: `${100 - leftPercent}%` }} className="min-w-0 overflow-hidden">
                    <Preview
                      key={activeId}
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
          </div>
        </div>

        <StatusBar
          line={activeDocument.cursor.line}
          col={activeDocument.cursor.col}
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
        <ExcalidrawEditor
          open={drawingOpen}
          theme={theme}
          onClose={() => setDrawingOpen(false)}
          onInsert={handleInsertDrawing}
        />
        <Toaster />
        <UploadIndicator />
      </div>
    </TooltipProvider>
  )
}

export default App

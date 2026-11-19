import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { resolveLanguage } from '@shared/i18n/resolve-language'
import { translate } from '@shared/i18n/translate'
import type { AppLanguage } from '@shared/i18n/types'
import {
  activeDocumentOf,
  createTabDocument,
  documentFileName,
  documentLabel,
  findDocumentById,
  findDocumentByPath,
  isDocumentDirty,
  isPathWithin,
  moveDocument as moveDocumentInList,
  neighborDocumentId,
  nextDocumentId,
  patchDocument,
  rebaseDocumentPaths,
  removeDocumentsUnder,
  withActiveId,
  type DocumentsState,
  type TabDocument
} from '@shared/documents'

function welcomeDocument(language: AppLanguage): string {
  return translate(language, 'welcome.document')
}

function languageFrom(code: string | undefined): AppLanguage {
  return resolveLanguage(code, code)
}

/** 移掉一个标签：空集合补一个空文档，移除活动标签时优先激活右邻居 */
function withoutDocument(state: DocumentsState, docId: string): DocumentsState {
  const nextActiveId = neighborDocumentId(state.documents, docId)
  const remaining = state.documents.filter((item) => item.id !== docId)
  if (remaining.length === 0) {
    const fresh = createTabDocument({ id: nextDocumentId(), content: '' })
    return { documents: [fresh], activeId: fresh.id }
  }
  const activeId = state.activeId === docId ? (nextActiveId ?? remaining[0].id) : state.activeId
  return { documents: remaining, activeId }
}

export interface UseDocumentsResult {
  documents: readonly TabDocument[]
  activeId: string
  activeDocument: TabDocument
  isDirty: boolean
  setContent: (docId: string, value: string) => void
  updateContent: (docId: string, updater: (prev: string) => string) => void
  getContent: (docId: string) => string
  setCursor: (docId: string, line: number, col: number) => void
  activate: (docId: string) => void
  activateIndex: (index: number) => void
  /** 拖拽排序：把标签插到移动前数组的 insertIndex 位置 */
  moveDocument: (docId: string, insertIndex: number) => void
  newDocument: () => void
  openFile: () => Promise<void>
  openPath: (path: string) => Promise<void>
  closeDocument: (docId: string) => Promise<boolean>
  /** 文件或目录被重命名后同步标签里的路径 */
  renamePath: (from: string, to: string) => void
  /** 文件或目录被删除后直接关掉对应标签（调用方已完成用户确认） */
  closeByPath: (path: string) => void
  /** 某个路径（可以是目录）下是否有未保存修改 */
  isPathDirty: (path: string) => boolean
  saveDocument: (docId?: string) => Promise<string | null>
  saveFile: () => Promise<boolean>
  saveFileAs: () => Promise<boolean>
  autoSave: () => Promise<void>
  confirmCloseAll: () => Promise<boolean>
  exportHtml: (html: string) => Promise<{ path: string } | null>
  exportPdf: (html: string) => Promise<{ path: string } | null>
}

export function useDocuments(): UseDocumentsResult {
  const { t } = useTranslation()
  const initialWelcome = welcomeDocument(languageFrom(i18n.language))
  const welcomeRef = useRef(initialWelcome)

  const [state, setState] = useState<DocumentsState>(() => {
    const document = createTabDocument({ id: nextDocumentId(), content: initialWelcome })
    return { documents: [document], activeId: document.id }
  })

  // IPC 回调与定时器要读最新值，用 ref 同步而不是闭包变量
  const stateRef = useRef(state)
  const commit = useCallback((updater: (prev: DocumentsState) => DocumentsState) => {
    setState((prev) => {
      const next = updater(prev)
      stateRef.current = next
      return next
    })
  }, [])

  const activeDocument = activeDocumentOf(state)
  const isDirty = isDocumentDirty(activeDocument)

  // 主进程据此限定预览图片的读取目录
  useEffect(() => {
    window.imageAPI.setDocumentPath(activeDocument.filePath)
  }, [activeDocument.filePath])

  // 语言切换时只替换「还没动过的欢迎稿」，不覆盖用户输入
  useEffect(() => {
    const onLanguageChanged = (code: string) => {
      const next = welcomeDocument(languageFrom(code))
      const previous = welcomeRef.current
      const current = stateRef.current
      const only = current.documents[0]
      const pristine =
        current.documents.length === 1 &&
        only.filePath === null &&
        !isDocumentDirty(only) &&
        only.content === previous
      if (!pristine) return
      commit((prev) => patchDocument(prev, only.id, { content: next, savedContent: next }))
      welcomeRef.current = next
    }
    i18n.on('languageChanged', onLanguageChanged)
    return () => {
      i18n.off('languageChanged', onLanguageChanged)
    }
  }, [commit])

  // ─── 内容与光标 ────────────────────────────────────────────────
  const setContent = useCallback(
    (docId: string, value: string) => {
      commit((prev) => patchDocument(prev, docId, { content: value }))
    },
    [commit]
  )

  // 占位符回填等异步改写：基于最新内容做替换，避免闭包里的旧值把用户输入覆盖掉
  const updateContent = useCallback(
    (docId: string, updater: (prev: string) => string) => {
      commit((prev) => {
        const document = findDocumentById(prev.documents, docId)
        if (!document) return prev
        return patchDocument(prev, docId, { content: updater(document.content) })
      })
    },
    [commit]
  )

  const getContent = useCallback((docId: string): string => {
    const document = findDocumentById(stateRef.current.documents, docId)
    return document?.content ?? ''
  }, [])

  const setCursor = useCallback(
    (docId: string, line: number, col: number) => {
      commit((prev) => {
        const document = findDocumentById(prev.documents, docId)
        if (!document) return prev
        if (document.cursor.line === line && document.cursor.col === col) return prev
        return patchDocument(prev, docId, { cursor: { line, col } })
      })
    },
    [commit]
  )

  // ─── 标签切换 ──────────────────────────────────────────────────
  const activate = useCallback(
    (docId: string) => {
      commit((prev) => {
        if (!findDocumentById(prev.documents, docId)) return prev
        return withActiveId(prev, docId)
      })
    },
    [commit]
  )

  /** ⌘1-9：0 基下标；超出范围时忽略，第 9 个固定取最后一个标签 */
  const activateIndex = useCallback(
    (index: number) => {
      const documents = stateRef.current.documents
      const target = index === 8 ? documents[documents.length - 1] : documents[index]
      if (target) activate(target.id)
    },
    [activate]
  )

  /** 拖拽排序只改数组顺序，活动标签与各编辑器实例保持不变 */
  const moveDocument = useCallback(
    (docId: string, insertIndex: number) => {
      commit((prev) => {
        const documents = moveDocumentInList(prev.documents, docId, insertIndex)
        return documents ? { ...prev, documents } : prev
      })
    },
    [commit]
  )

  // ─── 新建 / 打开 ───────────────────────────────────────────────
  // 多标签下新建与打开不再覆盖当前文档，因此不需要再问「要不要保存」
  const newDocument = useCallback(() => {
    commit((prev) => {
      const document = createTabDocument({ id: nextDocumentId(), content: '' })
      return { documents: [...prev.documents, document], activeId: document.id }
    })
  }, [commit])

  const applyOpenedFile = useCallback(
    (result: { path: string; content: string } | null) => {
      if (!result) return
      commit((prev) => {
        const existing = findDocumentByPath(prev.documents, result.path)
        if (existing) return withActiveId(prev, existing.id)
        const document = createTabDocument({
          id: nextDocumentId(),
          content: result.content,
          filePath: result.path
        })
        return { documents: [...prev.documents, document], activeId: document.id }
      })
    },
    [commit]
  )

  const openFile = useCallback(async () => {
    applyOpenedFile(await window.fileAPI.openDialog())
  }, [applyOpenedFile])

  const openPath = useCallback(
    async (path: string) => {
      applyOpenedFile(await window.fileAPI.openPath(path))
    },
    [applyOpenedFile]
  )

  // ─── 保存 ──────────────────────────────────────────────────────
  // 有路径就直接写盘，没有路径走另存为；返回最终落盘的路径，取消时返回 null
  const saveDocument = useCallback(
    async (docId?: string): Promise<string | null> => {
      const targetId = docId ?? stateRef.current.activeId
      const document = findDocumentById(stateRef.current.documents, targetId)
      if (!document) return null
      const content = document.content

      if (!document.filePath) {
        const result = await window.fileAPI.saveAs(content)
        if (!result) return null
        commit((prev) => patchDocument(prev, targetId, { filePath: result.path, savedContent: content }))
        return result.path
      }

      const { success } = await window.fileAPI.save(document.filePath, content)
      if (!success) return null
      commit((prev) => patchDocument(prev, targetId, { savedContent: content }))
      return document.filePath
    },
    [commit]
  )

  const saveFile = useCallback(async (): Promise<boolean> => {
    return (await saveDocument()) !== null
  }, [saveDocument])

  const saveFileAs = useCallback(async (): Promise<boolean> => {
    const document = activeDocumentOf(stateRef.current)
    const content = document.content
    const result = await window.fileAPI.saveAs(content)
    if (!result) return false
    commit((prev) => patchDocument(prev, document.id, { filePath: result.path, savedContent: content }))
    return true
  }, [commit])

  /** 自动保存：只写已经有路径且变脏的文档，不弹任何对话框 */
  const autoSave = useCallback(async () => {
    const dirty = stateRef.current.documents.filter(
      (document) => document.filePath !== null && isDocumentDirty(document)
    )
    for (const document of dirty) {
      const content = document.content
      const path = document.filePath
      if (!path) continue
      const { success } = await window.fileAPI.save(path, content)
      if (success) {
        commit((prev) => patchDocument(prev, document.id, { savedContent: content }))
      }
    }
  }, [commit])

  // ─── 关闭标签 ──────────────────────────────────────────────────
  /**
   * 关单个标签：脏内容走三态对话框，选「保存」时按该标签自身的路径写盘。
   * 关掉最后一个标签时补一个空文档，避免出现「零标签」的无主状态。
   */
  const closeDocument = useCallback(
    async (docId: string): Promise<boolean> => {
      const document = findDocumentById(stateRef.current.documents, docId)
      if (!document) return true

      if (isDocumentDirty(document)) {
        const choice = await window.windowAPI.confirmDiscardChanges(
          documentLabel(document, t('app.untitled'))
        )
        if (choice === 'cancel') return false
        if (choice === 'save' && (await saveDocument(docId)) === null) return false
      }

      commit((prev) => withoutDocument(prev, docId))
      return true
    },
    [commit, saveDocument, t]
  )

  /** 文件或目录在磁盘上被重命名后，把打开的标签同步到新路径（含目录下的子孙文档） */
  const renamePath = useCallback(
    (from: string, to: string) => {
      commit((prev) => rebaseDocumentPaths(prev, from, to))
    },
    [commit]
  )

  /** 文件或目录被删除后直接关掉对应标签（调用方已完成用户确认） */
  const closeByPath = useCallback(
    (path: string) => {
      commit((prev) => removeDocumentsUnder(prev, path))
    },
    [commit]
  )

  /** 某个路径（可以是目录）下的文档是否有未保存修改 */
  const isPathDirty = useCallback((path: string): boolean => {
    return stateRef.current.documents.some(
      (document) =>
        document.filePath !== null &&
        isPathWithin(document.filePath, path) &&
        isDocumentDirty(document)
    )
  }, [])

  /** 关窗口前挨个过一遍脏标签，任一取消就整体中止 */
  const confirmCloseAll = useCallback(async (): Promise<boolean> => {
    for (const document of stateRef.current.documents) {
      if (!isDocumentDirty(document)) continue
      const choice = await window.windowAPI.confirmDiscardChanges(
        documentLabel(document, t('app.untitled'))
      )
      if (choice === 'cancel') return false
      if (choice === 'save' && (await saveDocument(document.id)) === null) return false
    }
    return true
  }, [saveDocument, t])

  // ─── 导出 ──────────────────────────────────────────────────────
  const exportHtml = useCallback(async (html: string) => {
    const document = activeDocumentOf(stateRef.current)
    return window.fileAPI.exportHtml(
      html,
      documentFileName(document.filePath) ?? undefined,
      document.filePath ?? undefined
    )
  }, [])

  const exportPdf = useCallback(async (html: string) => {
    const document = activeDocumentOf(stateRef.current)
    return window.fileAPI.exportPdf(
      html,
      documentFileName(document.filePath) ?? undefined,
      document.filePath ?? undefined
    )
  }, [])

  // ─── 菜单与关闭握手 ────────────────────────────────────────────
  useEffect(() => {
    const unsubNew = window.fileAPI.onMenuNew(newDocument)
    const unsubOpen = window.fileAPI.onMenuOpen(() => {
      void openFile()
    })
    const unsubOpenRecent = window.fileAPI.onMenuOpenRecent((path) => {
      void openPath(path)
    })
    const unsubSave = window.fileAPI.onMenuSave(() => {
      void saveFile()
    })
    const unsubSaveAs = window.fileAPI.onMenuSaveAs(() => {
      void saveFileAs()
    })
    return () => {
      unsubNew()
      unsubOpen()
      unsubOpenRecent()
      unsubSave()
      unsubSaveAs()
    }
  }, [newDocument, openFile, openPath, saveFile, saveFileAs])

  useEffect(() => {
    return window.windowAPI.onWillClose(() => {
      void (async () => {
        if (await confirmCloseAll()) {
          window.windowAPI.confirmClose()
        } else {
          window.windowAPI.cancelClose()
        }
      })()
    })
  }, [confirmCloseAll])

  // 更新窗口标题：只反映当前活动标签
  useEffect(() => {
    let title = 'BiuText'
    const name = documentFileName(activeDocument.filePath)
    if (name) {
      title = isDirty ? `${name} · BiuText` : `${name} - BiuText`
    } else if (isDirty) {
      title = `${t('app.untitled')} · BiuText`
    }
    window.windowAPI.setTitle(title)
    document.title = title
  }, [activeDocument.filePath, isDirty, t])

  return {
    documents: state.documents,
    activeId: state.activeId,
    activeDocument,
    isDirty,
    setContent,
    updateContent,
    getContent,
    setCursor,
    activate,
    activateIndex,
    moveDocument,
    newDocument,
    openFile,
    openPath,
    closeDocument,
    renamePath,
    closeByPath,
    isPathDirty,
    saveDocument,
    saveFile,
    saveFileAs,
    autoSave,
    confirmCloseAll,
    exportHtml,
    exportPdf
  }
}

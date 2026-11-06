import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { resolveLanguage } from '@shared/i18n/resolve-language'
import { translate } from '@shared/i18n/translate'
import type { AppLanguage } from '@shared/i18n/types'

function welcomeDocument(language: AppLanguage): string {
  return translate(language, 'welcome.document')
}

function languageFrom(code: string | undefined): AppLanguage {
  return resolveLanguage(code, code)
}

function documentName(path: string | null, fallback: string): string {
  if (!path) return fallback
  return path.replaceAll('\\', '/').split('/').pop() || fallback
}

export interface FileState {
  content: string
  filePath: string | null
  isDirty: boolean
}

export function useFile() {
  const { t } = useTranslation()
  const initialWelcome = welcomeDocument(languageFrom(i18n.language))
  const [content, setContentState] = useState(initialWelcome)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [savedContent, setSavedContent] = useState(initialWelcome)
  const welcomeRef = useRef(initialWelcome)

  const isDirty = content !== savedContent

  // 用 ref 存最新的值，供 IPC 事件处理器使用（避免闭包旧值）
  const stateRef = useRef({ content, filePath, isDirty })
  useEffect(() => {
    stateRef.current = { content, filePath, isDirty }
  }, [content, filePath, isDirty])

  // 主进程据此限定预览图片的读取目录
  useEffect(() => {
    window.imageAPI.setDocumentPath(filePath)
  }, [filePath])

  useEffect(() => {
    const onLanguageChanged = (code: string) => {
      const next = welcomeDocument(languageFrom(code))
      const previous = welcomeRef.current
      const state = stateRef.current
      if (state.filePath === null && !state.isDirty && state.content === previous) {
        setContentState(next)
        setSavedContent(next)
        welcomeRef.current = next
      }
    }
    i18n.on('languageChanged', onLanguageChanged)
    return () => {
      i18n.off('languageChanged', onLanguageChanged)
    }
  }, [])

  const setContent = useCallback((val: string) => {
    setContentState(val)
  }, [])

  // 占位符回填等异步改写：基于最新内容做替换，避免闭包里的旧值把用户输入覆盖掉
  const updateContent = useCallback((updater: (prev: string) => string) => {
    setContentState((prev) => updater(prev))
  }, [])

  // 有路径就直接写盘，没有路径走另存为；返回最终落盘的路径，取消时返回 null
  const saveDocument = useCallback(async (): Promise<string | null> => {
    const { content: cur, filePath: path } = stateRef.current
    if (!path) {
      const result = await window.fileAPI.saveAs(cur)
      if (!result) return null
      setFilePath(result.path)
      setSavedContent(cur)
      return result.path
    }
    const { success } = await window.fileAPI.save(path, cur)
    if (success) setSavedContent(cur)
    return success ? path : null
  }, [])

  const saveFile = useCallback(async (): Promise<boolean> => {
    return (await saveDocument()) !== null
  }, [saveDocument])

  // 新建/打开/关闭共用的脏检查：交给主进程弹三态对话框，选"保存"时真的写盘
  const confirmLeaveCurrentDocument = useCallback(async (): Promise<boolean> => {
    const { isDirty: dirty, filePath: path } = stateRef.current
    if (!dirty) return true
    const name = documentName(path, t('app.untitled'))
    const choice = await window.windowAPI.confirmDiscardChanges(name)
    if (choice === 'cancel') return false
    if (choice === 'discard') return true
    return saveFile()
  }, [saveFile, t])

  const newFile = useCallback(async () => {
    if (!(await confirmLeaveCurrentDocument())) return
    setContentState('')
    setFilePath(null)
    setSavedContent('')
  }, [confirmLeaveCurrentDocument])

  const applyOpenedFile = useCallback((result: { path: string; content: string } | null) => {
    if (!result) return
    setContentState(result.content)
    setFilePath(result.path)
    setSavedContent(result.content)
  }, [])

  const openFile = useCallback(async () => {
    if (!(await confirmLeaveCurrentDocument())) return
    const result = await window.fileAPI.openDialog()
    applyOpenedFile(result)
  }, [applyOpenedFile, confirmLeaveCurrentDocument])

  const openRecentFile = useCallback(
    async (path: string) => {
      if (!(await confirmLeaveCurrentDocument())) return
      const result = await window.fileAPI.openPath(path)
      applyOpenedFile(result)
    },
    [applyOpenedFile, confirmLeaveCurrentDocument]
  )

  const autoSave = useCallback(async () => {
    const { content: cur, filePath: path, isDirty: dirty } = stateRef.current
    if (!path || !dirty) return
    const { success } = await window.fileAPI.save(path, cur)
    if (success) setSavedContent(cur)
  }, [])

  const saveFileAs = useCallback(async () => {
    const { content: cur } = stateRef.current
    const result = await window.fileAPI.saveAs(cur)
    if (!result) return
    setFilePath(result.path)
    setSavedContent(cur)
  }, [])

  const exportHtml = useCallback(async (html: string) => {
    const { filePath: path } = stateRef.current
    const fileName = path ? path.replaceAll('\\', '/').split('/').pop() ?? undefined : undefined
    await window.fileAPI.exportHtml(html, fileName, path ?? undefined)
  }, [])

  const exportPdf = useCallback(async (html: string) => {
    const { filePath: path } = stateRef.current
    const fileName = path ? path.replaceAll('\\', '/').split('/').pop() ?? undefined : undefined
    await window.fileAPI.exportPdf(html, fileName, path ?? undefined)
  }, [])

  // 监听菜单事件
  useEffect(() => {
    const unsubNew = window.fileAPI.onMenuNew(newFile)
    const unsubOpen = window.fileAPI.onMenuOpen(openFile)
    const unsubOpenRecent = window.fileAPI.onMenuOpenRecent(openRecentFile)
    const unsubSave = window.fileAPI.onMenuSave(saveFile)
    const unsubSaveAs = window.fileAPI.onMenuSaveAs(saveFileAs)
    return () => {
      unsubNew()
      unsubOpen()
      unsubOpenRecent()
      unsubSave()
      unsubSaveAs()
    }
  }, [newFile, openFile, openRecentFile, saveFile, saveFileAs])

  // 窗口关闭前确认
  useEffect(() => {
    const unsub = window.windowAPI.onWillClose(() => {
      void (async () => {
        if (await confirmLeaveCurrentDocument()) {
          window.windowAPI.confirmClose()
        } else {
          window.windowAPI.cancelClose()
        }
      })()
    })
    return unsub
  }, [confirmLeaveCurrentDocument])

  // 更新窗口标题
  useEffect(() => {
    let title = 'BiuText'
    if (filePath) {
      const fileName = filePath.replaceAll('\\', '/').split('/').pop() ?? filePath
      title = isDirty ? `${fileName} · BiuText` : `${fileName} - BiuText`
    } else if (isDirty) {
      title = `${t('app.untitled')} · BiuText`
    }
    window.windowAPI.setTitle(title)
    document.title = title
  }, [filePath, isDirty, t])

  return {
    content,
    filePath,
    isDirty,
    setContent,
    updateContent,
    newFile,
    openFile,
    saveFile,
    saveDocument,
    autoSave,
    saveFileAs,
    exportHtml,
    exportPdf
  }
}

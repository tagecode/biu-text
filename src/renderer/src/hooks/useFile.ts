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

  const newFile = useCallback(() => {
    setContentState('')
    setFilePath(null)
    setSavedContent('')
  }, [])

  const applyOpenedFile = useCallback((result: { path: string; content: string } | null) => {
    if (!result) return
    setContentState(result.content)
    setFilePath(result.path)
    setSavedContent(result.content)
  }, [])

  const openFile = useCallback(async () => {
    const result = await window.fileAPI.openDialog()
    applyOpenedFile(result)
  }, [applyOpenedFile])

  const openRecentFile = useCallback(
    async (path: string) => {
      const result = await window.fileAPI.openPath(path)
      applyOpenedFile(result)
    },
    [applyOpenedFile]
  )

  const saveFile = useCallback(async () => {
    const { content: cur, filePath: path } = stateRef.current
    if (!path) {
      // 没有路径，执行另存为
      const result = await window.fileAPI.saveAs(cur)
      if (!result) return
      setFilePath(result.path)
      setSavedContent(cur)
    } else {
      const { success } = await window.fileAPI.save(path, cur)
      if (success) setSavedContent(cur)
    }
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
    await window.fileAPI.exportHtml(html, fileName)
  }, [])

  const exportPdf = useCallback(async (html: string) => {
    const { filePath: path } = stateRef.current
    const fileName = path ? path.replaceAll('\\', '/').split('/').pop() ?? undefined : undefined
    await window.fileAPI.exportPdf(html, fileName)
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
      if (!stateRef.current.isDirty) {
        window.windowAPI.confirmClose()
        return
      }
      const confirmed = window.confirm(t('dialog.unsavedClose'))
      if (confirmed) {
        window.windowAPI.confirmClose()
      } else {
        window.windowAPI.cancelClose()
      }
    })
    return unsub
  }, [t])

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
    newFile,
    openFile,
    saveFile,
    saveFileAs,
    exportHtml,
    exportPdf
  }
}

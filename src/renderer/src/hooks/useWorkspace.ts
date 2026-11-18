import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast-store'
import type { WorkspaceSnapshot } from '@shared/workspace'

export interface UseWorkspaceOptions {
  /** 点击文件树里的文件：交给文档层新开/激活标签 */
  onOpenFile: (path: string) => void
  /** 重命名成功后同步已打开标签的路径 */
  onRenamed: (from: string, to: string) => void
  /** 删除成功后关掉对应标签 */
  onDeleted: (path: string) => void
  /** 判断某个文件是否有未保存修改（删除确认要用） */
  isDirty: (path: string) => boolean
  /** 启动时成功恢复了上次打开的文件夹 */
  onRestored?: () => void
}

/** 记住上次打开的文件夹，下次启动直接恢复（文件夹不在了就清掉） */
const WORKSPACE_ROOT_STORAGE_KEY = 'biu-text:workspace-root'

function readStoredRoot(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_ROOT_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredRoot(root: string | null): void {
  try {
    if (root) localStorage.setItem(WORKSPACE_ROOT_STORAGE_KEY, root)
    else localStorage.removeItem(WORKSPACE_ROOT_STORAGE_KEY)
  } catch {
    // 配额或隐私模式下写不进去，不影响本次使用
  }
}

export interface UseWorkspaceResult {
  root: string | null
  entries: WorkspaceSnapshot['entries']
  skipped: number
  loading: boolean
  /** 弹目录选择框；用户取消时返回 false，什么都不变 */
  openFolder: () => Promise<boolean>
  /** 重新读取当前根目录 */
  refresh: () => Promise<void>
  closeFolder: () => void
  rename: (path: string, name: string) => Promise<boolean>
  remove: (path: string) => Promise<boolean>
  openFile: (path: string) => void
}

/**
 * 文件树的数据与操作。
 *
 * 目录遍历、重命名、删除全在主进程完成（渲染进程没有 fs 权限），
 * 这里只负责状态、乐观刷新与「操作成功后同步标签」的协作。
 */
export function useWorkspace(options: UseWorkspaceOptions): UseWorkspaceResult {
  const { onOpenFile, onRenamed, onDeleted, isDirty, onRestored } = options
  const { t } = useTranslation()
  const [root, setRoot] = useState<string | null>(null)
  const [entries, setEntries] = useState<WorkspaceSnapshot['entries']>([])
  const [skipped, setSkipped] = useState(0)
  const [loading, setLoading] = useState(false)

  // IPC 回调里要读最新根目录，避免闭包里的旧值
  const rootRef = useRef<string | null>(null)
  useEffect(() => {
    rootRef.current = root
  }, [root])

  const applySnapshot = useCallback((snapshot: WorkspaceSnapshot | null) => {
    if (!snapshot) return false
    setRoot(snapshot.root)
    setEntries(snapshot.entries)
    setSkipped(snapshot.skipped)
    return true
  }, [])

  const openFolder = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const snapshot = await window.workspaceAPI.openFolder()
      if (!snapshot) return false
      applySnapshot(snapshot)
      writeStoredRoot(snapshot.root)
      return true
    } finally {
      setLoading(false)
    }
  }, [applySnapshot])

  // 启动时恢复上次打开的文件夹；目录已经不在就清掉记录
  useEffect(() => {
    const stored = readStoredRoot()
    if (!stored) return
    let cancelled = false
    void (async () => {
      const snapshot = await window.workspaceAPI.load(stored)
      if (cancelled) return
      if (snapshot && applySnapshot(snapshot)) {
        writeStoredRoot(snapshot.root)
        onRestored?.()
        return
      }
      writeStoredRoot(null)
    })()
    return () => {
      cancelled = true
    }
  }, [applySnapshot, onRestored])

  const refresh = useCallback(async () => {
    const currentRoot = rootRef.current
    if (!currentRoot) return
    setLoading(true)
    try {
      const snapshot = await window.workspaceAPI.load(currentRoot)
      if (!applySnapshot(snapshot)) {
        // 根目录被删掉或无法读取：关掉文件树，避免显示过期内容
        setRoot(null)
        setEntries([])
        setSkipped(0)
        writeStoredRoot(null)
      }
    } finally {
      setLoading(false)
    }
  }, [applySnapshot])

  const closeFolder = useCallback(() => {
    setRoot(null)
    setEntries([])
    setSkipped(0)
    writeStoredRoot(null)
  }, [])

  const openFile = useCallback(
    (path: string) => {
      onOpenFile(path)
    },
    [onOpenFile]
  )

  const rename = useCallback(
    async (path: string, name: string): Promise<boolean> => {
      const currentRoot = rootRef.current
      if (!currentRoot) return false
      const result = await window.workspaceAPI.rename(currentRoot, path, name)
      if (!result.ok) {
        const key =
          result.error === 'invalid'
            ? 'workspace.renameInvalid'
            : result.error === 'exists'
              ? 'workspace.renameExists'
              : 'workspace.renameFailed'
        toast({ level: 'error', title: t(key) })
        return false
      }
      if (result.path && result.previousPath) onRenamed(result.previousPath, result.path)
      await refresh()
      return true
    },
    [onRenamed, refresh, t]
  )

  const remove = useCallback(
    async (path: string): Promise<boolean> => {
      const currentRoot = rootRef.current
      if (!currentRoot) return false
      // 删除确认在主进程弹原生对话框，这里只把"是否有未保存修改"带过去
      const result = await window.workspaceAPI.remove(currentRoot, path, isDirty(path))
      if (!result.ok) {
        if (!result.canceled) toast({ level: 'error', title: t('workspace.deleteFailed') })
        return false
      }
      onDeleted(path)
      await refresh()
      return true
    },
    [isDirty, onDeleted, refresh, t]
  )

  return {
    root,
    entries,
    skipped,
    loading,
    openFolder,
    refresh,
    closeFolder,
    rename,
    remove,
    openFile
  }
}
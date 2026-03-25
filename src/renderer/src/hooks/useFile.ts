import { useState, useCallback, useEffect, useRef } from 'react'

const WELCOME_CONTENT = `# 欢迎使用 BiuText

BiuText 是一款轻量级的跨平台 Markdown 编辑器，采用经典的**分栏布局**。

## 快速开始

- **左侧**为 Markdown 源码编辑区（基于 CodeMirror 6）
- **右侧**为实时渲染预览区（基于 markdown-it）
- 拖动中间**分隔条**可自由调整面板宽度

## 格式快捷键

| 操作 | 快捷键 |
|------|--------|
| 粗体 | \`Cmd/Ctrl + B\` |
| 斜体 | \`Cmd/Ctrl + I\` |
| 行内代码 | \`Cmd/Ctrl + \`\` |
| 链接 | \`Cmd/Ctrl + K\` |
| 保存 | \`Cmd/Ctrl + S\` |

## 支持的语法

**粗体**、*斜体*、~~删除线~~、\`行内代码\`

> 引用块：用于引用重要内容

\`\`\`typescript
// 代码块支持语法高亮
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

- [x] 任务列表（已完成）
- [ ] 任务列表（未完成）

---

*开始编辑此文件，或通过菜单打开一个 .md 文件*
`

export interface FileState {
  content: string
  filePath: string | null
  isDirty: boolean
}

export function useFile() {
  const [content, setContentState] = useState(WELCOME_CONTENT)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [savedContent, setSavedContent] = useState(WELCOME_CONTENT)

  const isDirty = content !== savedContent

  // 用 ref 存最新的值，供 IPC 事件处理器使用（避免闭包旧值）
  const stateRef = useRef({ content, filePath, isDirty })
  useEffect(() => {
    stateRef.current = { content, filePath, isDirty }
  }, [content, filePath, isDirty])

  const setContent = useCallback((val: string) => {
    setContentState(val)
  }, [])

  const newFile = useCallback(() => {
    setContentState('')
    setFilePath(null)
    setSavedContent('')
  }, [])

  const openFile = useCallback(async () => {
    const result = await window.fileAPI.openDialog()
    if (!result) return
    setContentState(result.content)
    setFilePath(result.path)
    setSavedContent(result.content)
  }, [])

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

  // 监听菜单事件
  useEffect(() => {
    const unsubNew = window.fileAPI.onMenuNew(newFile)
    const unsubOpen = window.fileAPI.onMenuOpen(openFile)
    const unsubSave = window.fileAPI.onMenuSave(saveFile)
    const unsubSaveAs = window.fileAPI.onMenuSaveAs(saveFileAs)
    return () => {
      unsubNew()
      unsubOpen()
      unsubSave()
      unsubSaveAs()
    }
  }, [newFile, openFile, saveFile, saveFileAs])

  // 窗口关闭前确认
  useEffect(() => {
    const unsub = window.windowAPI.onWillClose(() => {
      if (!stateRef.current.isDirty) {
        window.windowAPI.confirmClose()
        return
      }
      const confirmed = window.confirm('文件有未保存的更改，确定要关闭吗？')
      if (confirmed) {
        window.windowAPI.confirmClose()
      } else {
        window.windowAPI.cancelClose()
      }
    })
    return unsub
  }, [])

  // 更新窗口标题
  useEffect(() => {
    let title = 'BiuText'
    if (filePath) {
      const fileName = filePath.split('/').pop() ?? filePath
      title = isDirty ? `${fileName} · BiuText` : `${fileName} - BiuText`
    } else if (isDirty) {
      title = '未命名 · BiuText'
    }
    window.windowAPI.setTitle(title)
    document.title = title
  }, [filePath, isDirty])

  return {
    content,
    filePath,
    isDirty,
    setContent,
    newFile,
    openFile,
    saveFile,
    saveFileAs
  }
}

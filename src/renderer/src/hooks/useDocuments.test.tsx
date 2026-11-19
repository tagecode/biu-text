/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocuments } from './useDocuments'

const unsub = (): (() => void) => () => undefined

let confirmChoice: 'save' | 'discard' | 'cancel' = 'cancel'
/** 按顺序消费的三态结果；空时回退到 confirmChoice */
let confirmQueue: Array<'save' | 'discard' | 'cancel'> = []
let saveDialogResult: { path: string } | null = null
let willClose: (() => void) | null = null

const fileAPISave = vi.fn(async () => ({ success: true }))
const fileAPISaveAs = vi.fn(async () => saveDialogResult)
const confirmDiscardChanges = vi.fn(async () => confirmQueue.shift() ?? confirmChoice)
const confirmClose = vi.fn()
const cancelClose = vi.fn()

beforeEach(() => {
  confirmChoice = 'cancel'
  confirmQueue = []
  saveDialogResult = null
  willClose = null
  fileAPISave.mockClear()
  fileAPISaveAs.mockClear()
  confirmDiscardChanges.mockClear()
  confirmClose.mockClear()
  cancelClose.mockClear()

  window.fileAPI = {
    openDialog: async () => null,
    openPath: async (path: string) => ({ path, content: `# ${path}` }),
    save: fileAPISave,
    saveAs: fileAPISaveAs,
    exportHtml: async () => null,
    exportPdf: async () => null,
    onMenuNew: () => unsub(),
    onMenuOpen: () => unsub(),
    onMenuOpenRecent: () => unsub(),
    onMenuSave: () => unsub(),
    onMenuSaveAs: () => unsub(),
    onMenuExportHtml: () => unsub(),
    onMenuExportPdf: () => unsub(),
    onMenuFind: () => unsub(),
    onMenuReplace: () => unsub()
  }

  window.windowAPI = {
    platform: 'win32',
    confirmDiscardChanges,
    setTitle: () => undefined,
    onWillClose: (cb) => {
      willClose = cb
      return () => {
        if (willClose === cb) willClose = null
      }
    },
    onNotify: () => unsub(),
    confirmClose,
    cancelClose
  }

  window.imageAPI = {
    setDocumentPath: () => undefined,
    saveImages: async () => [],
    pickImages: async () => [],
    pickImageInputs: async () => [],
    getHostConfig: async () => ({
      type: 'local',
      github: { repo: '', branch: 'main', dir: '', tokenMasked: '', tokenSaved: false },
      custom: { url: '', field: 'file', headers: {}, responsePath: '' }
    }),
    setHostConfig: async (view) => view,
    testHost: async () => ({ ok: true }),
    upload: async () => ({ ok: false, error: 'unused' }),
    onUploadProgress: () => unsub()
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDocuments', () => {
  it('初始只有一个欢迎稿标签，且未落盘', () => {
    const { result } = renderHook(() => useDocuments())
    expect(result.current.documents).toHaveLength(1)
    expect(result.current.activeDocument.filePath).toBeNull()
    expect(result.current.activeDocument.content.length).toBeGreaterThan(0)
    expect(result.current.isDirty).toBe(false)
  })

  it('新建标签不会覆盖当前文档', async () => {
    const { result } = renderHook(() => useDocuments())
    const firstId = result.current.activeId

    act(() => result.current.newDocument())

    expect(result.current.documents).toHaveLength(2)
    expect(result.current.activeId).not.toBe(firstId)
    expect(result.current.activeDocument.content).toBe('')
    // 原标签仍在，活动 id 切换了但内容没被清掉
    expect(result.current.documents.some((doc) => doc.id === firstId)).toBe(true)
  })

  it('打开文件新增标签，同一路径只保留一个标签', async () => {
    const { result } = renderHook(() => useDocuments())

    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    expect(result.current.documents).toHaveLength(2)
    const openedId = result.current.activeId
    expect(result.current.activeDocument.content).toBe('# /notes/a.md')

    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    expect(result.current.documents).toHaveLength(2)
    expect(result.current.activeId).toBe(openedId)
  })

  it('命中已打开的路径时激活既有标签，不重载内容', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    const openedId = result.current.activeId
    act(() => result.current.setContent(openedId, '# 改过了'))
    act(() => result.current.activate(result.current.documents[0].id))

    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    expect(result.current.activeId).toBe(openedId)
    expect(result.current.activeDocument.content).toBe('# 改过了')
  })

  it('每标签的脏标记互不影响', async () => {
    const { result } = renderHook(() => useDocuments())
    const firstId = result.current.activeId
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    const secondId = result.current.activeId

    act(() => result.current.setContent(firstId, '只改第一个'))

    expect(result.current.activeDocument.id).toBe(secondId)
    expect(result.current.isDirty).toBe(false)
    const first = result.current.documents.find((doc) => doc.id === firstId)
    expect(first?.content).toBe('只改第一个')
  })

  it('关脏标签选取消时保留标签', async () => {
    const { result } = renderHook(() => useDocuments())
    const firstId = result.current.activeId
    act(() => result.current.setContent(firstId, '改了'))
    confirmChoice = 'cancel'

    let closed = true
    await act(async () => {
      closed = await result.current.closeDocument(firstId)
    })

    expect(closed).toBe(false)
    expect(result.current.documents).toHaveLength(1)
  })

  it('关脏标签选不保存时直接移除', async () => {
    const { result } = renderHook(() => useDocuments())
    const firstId = result.current.activeId
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    act(() => result.current.setContent(firstId, '改了'))
    confirmChoice = 'discard'

    await act(async () => {
      await result.current.closeDocument(firstId)
    })

    expect(result.current.documents).toHaveLength(1)
    expect(result.current.documents[0].id).not.toBe(firstId)
  })

  it('关脏标签选保存时先写盘再移除', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    const targetId = result.current.activeId
    act(() => result.current.setContent(targetId, '# 保存我'))
    confirmChoice = 'save'

    await act(async () => {
      await result.current.closeDocument(targetId)
    })

    expect(fileAPISave).toHaveBeenCalledWith('/notes/a.md', '# 保存我')
    expect(result.current.documents.some((doc) => doc.id === targetId)).toBe(false)
  })

  it('关掉最后一个标签会补一个空文档，不会出现零标签', async () => {
    const { result } = renderHook(() => useDocuments())
    const onlyId = result.current.activeId

    await act(async () => {
      await result.current.closeDocument(onlyId)
    })

    expect(result.current.documents).toHaveLength(1)
    expect(result.current.activeDocument.content).toBe('')
    expect(result.current.activeDocument.filePath).toBeNull()
  })

  it('关掉活动标签后优先激活右边那个', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    const firstId = result.current.documents[0].id
    const secondId = result.current.activeId

    await act(async () => {
      await result.current.closeDocument(firstId)
    })

    expect(result.current.activeId).toBe(secondId)
  })

  it('自动保存只写有路径且变脏的文档', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    const openedId = result.current.activeId
    act(() => result.current.setContent(openedId, '# 脏了'))

    await act(async () => {
      await result.current.autoSave()
    })

    expect(fileAPISave).toHaveBeenCalledTimes(1)
    expect(fileAPISave).toHaveBeenCalledWith('/notes/a.md', '# 脏了')
    // 写盘后文档回到干净状态
    const saved = result.current.documents.find((doc) => doc.id === openedId)
    expect(saved?.savedContent).toBe('# 脏了')
  })

  it('另存为把路径写回标签', async () => {
    const { result } = renderHook(() => useDocuments())
    const docId = result.current.activeId
    act(() => result.current.setContent(docId, '内容'))
    saveDialogResult = { path: '/notes/new.md' }

    await act(async () => {
      await result.current.saveFile()
    })

    expect(fileAPISaveAs).toHaveBeenCalledWith('内容')
    expect(result.current.activeDocument.filePath).toBe('/notes/new.md')
    expect(result.current.isDirty).toBe(false)
  })

  it('目录重命名后同步其下所有标签的路径', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/docs/a.md')
    })
    await act(async () => {
      await result.current.openPath('/notes/docs/deep/b.md')
    })

    act(() => result.current.renamePath('/notes/docs', '/notes/new'))

    const paths = result.current.documents.map((document) => document.filePath)
    expect(paths).toEqual([null, '/notes/new/a.md', '/notes/new/deep/b.md'])
  })

  it('目录删除后关掉其下所有标签，保留无关标签', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/docs/a.md')
    })
    await act(async () => {
      await result.current.openPath('/notes/docs/deep/b.md')
    })
    await act(async () => {
      await result.current.openPath('/notes/other.md')
    })

    act(() => result.current.closeByPath('/notes/docs'))

    const paths = result.current.documents.map((document) => document.filePath)
    expect(paths).toEqual([null, '/notes/other.md'])
  })

  it('目录的脏检查覆盖其下所有文档', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/docs/a.md')
    })
    const docId = result.current.activeId
    act(() => result.current.setContent(docId, '改了'))

    expect(result.current.isPathDirty('/notes/docs/a.md')).toBe(true)
    expect(result.current.isPathDirty('/notes/docs')).toBe(true)
    expect(result.current.isPathDirty('/notes/docs2')).toBe(false)
    expect(result.current.isPathDirty('/notes/other.md')).toBe(false)
  })

  it('⌘1-9 的下标越界时保持不变，第 9 个落在最后一个标签', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    const lastId = result.current.activeId

    act(() => result.current.activateIndex(0))
    expect(result.current.activeId).not.toBe(lastId)

    act(() => result.current.activateIndex(8))
    expect(result.current.activeId).toBe(lastId)

    act(() => result.current.activateIndex(5))
    expect(result.current.activeId).toBe(lastId)
  })

  it('关闭窗口前逐个确认脏标签，任一取消就整体中止', async () => {
    const { result } = renderHook(() => useDocuments())
    const firstId = result.current.activeId
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    const secondId = result.current.activeId
    act(() => {
      result.current.setContent(firstId, '改了 a')
      result.current.setContent(secondId, '改了 b')
    })
    confirmChoice = 'cancel'

    let canClose = true
    await act(async () => {
      canClose = await result.current.confirmCloseAll()
    })
    expect(canClose).toBe(false)
  })

  it('关窗时没有脏标签直接放行，不弹确认框', async () => {
    renderHook(() => useDocuments())
    await waitFor(() => expect(willClose).not.toBeNull())

    act(() => willClose?.())

    await waitFor(() => expect(confirmClose).toHaveBeenCalledTimes(1))
    expect(cancelClose).not.toHaveBeenCalled()
    expect(confirmDiscardChanges).not.toHaveBeenCalled()
  })

  it('关窗时逐个保存脏标签，全部成功后放行', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    act(() => result.current.setContent(result.current.activeId, '改 A'))
    await act(async () => {
      await result.current.openPath('/notes/b.md')
    })
    act(() => result.current.setContent(result.current.activeId, '改 B'))
    confirmQueue = ['save', 'save']

    act(() => willClose?.())

    await waitFor(() => expect(confirmClose).toHaveBeenCalledTimes(1))
    expect(cancelClose).not.toHaveBeenCalled()
    expect(fileAPISave).toHaveBeenNthCalledWith(1, '/notes/a.md', '改 A')
    expect(fileAPISave).toHaveBeenNthCalledWith(2, '/notes/b.md', '改 B')
  })

  it('关窗时第二个标签取消：整体中止，已处理的标签保持已保存', async () => {
    const { result } = renderHook(() => useDocuments())
    await act(async () => {
      await result.current.openPath('/notes/a.md')
    })
    act(() => result.current.setContent(result.current.activeId, '改 A'))
    await act(async () => {
      await result.current.openPath('/notes/b.md')
    })
    act(() => result.current.setContent(result.current.activeId, '改 B'))
    confirmQueue = ['save', 'cancel']

    act(() => willClose?.())

    await waitFor(() => expect(cancelClose).toHaveBeenCalledTimes(1))
    expect(confirmClose).not.toHaveBeenCalled()
    expect(fileAPISave).toHaveBeenCalledTimes(1)
    expect(fileAPISave).toHaveBeenCalledWith('/notes/a.md', '改 A')
  })

  it('内容改动会同步更新窗口标题的脏标记', async () => {
    const setTitle = vi.fn()
    window.windowAPI.setTitle = setTitle
    const { result } = renderHook(() => useDocuments())
    const docId = result.current.activeId

    act(() => result.current.setContent(docId, '改了'))

    await waitFor(() => {
      expect(setTitle).toHaveBeenCalledWith(expect.stringContaining('· BiuText'))
    })
  })
})

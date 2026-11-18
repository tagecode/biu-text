/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import '@/i18n'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getToasts, resetToasts } from '@/lib/toast-store'
import type { WorkspaceSnapshot } from '@shared/workspace'
import { useWorkspace } from './useWorkspace'

const ROOT = '/notes'

function snapshot(names: string[]): WorkspaceSnapshot {
  return {
    root: ROOT,
    entries: names.map((name) => ({ path: `${ROOT}/${name}`, name, type: 'file' as const })),
    skipped: 0
  }
}

const openFolder = vi.fn()
const load = vi.fn()
const rename = vi.fn()
const remove = vi.fn()

beforeEach(() => {
  openFolder.mockReset()
  load.mockReset()
  rename.mockReset()
  remove.mockReset()
  resetToasts()
  localStorage.clear()

  window.workspaceAPI = {
    openFolder,
    load,
    rename,
    remove
  }
})

function setup(overrides: Partial<Parameters<typeof useWorkspace>[0]> = {}) {
  const callbacks = {
    onOpenFile: vi.fn(),
    onRenamed: vi.fn(),
    onDeleted: vi.fn(),
    isDirty: vi.fn(() => false),
    ...overrides
  }
  const view = renderHook(() => useWorkspace(callbacks))
  return { ...view, callbacks }
}

describe('useWorkspace', () => {
  it('打开文件夹后写入树；用户取消时保持原状', async () => {
    const { result } = setup()

    openFolder.mockResolvedValueOnce(null)
    await act(async () => {
      expect(await result.current.openFolder()).toBe(false)
    })
    expect(result.current.root).toBeNull()

    openFolder.mockResolvedValueOnce(snapshot(['a.md', 'b.md']))
    await act(async () => {
      expect(await result.current.openFolder()).toBe(true)
    })
    expect(result.current.root).toBe(ROOT)
    expect(result.current.entries.map((entry) => entry.name)).toEqual(['a.md', 'b.md'])
  })

  it('刷新会按当前根目录重新读取', async () => {
    const { result } = setup()
    openFolder.mockResolvedValueOnce(snapshot(['a.md']))
    await act(async () => {
      await result.current.openFolder()
    })

    load.mockResolvedValueOnce(snapshot(['a.md', 'new.md']))
    await act(async () => {
      await result.current.refresh()
    })
    expect(load).toHaveBeenCalledWith(ROOT)
    expect(result.current.entries).toHaveLength(2)
  })

  it('根目录读不到时清空文件树', async () => {
    const { result } = setup()
    openFolder.mockResolvedValueOnce(snapshot(['a.md']))
    await act(async () => {
      await result.current.openFolder()
    })

    load.mockResolvedValueOnce(null)
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.root).toBeNull()
    expect(result.current.entries).toEqual([])
  })

  it('关闭文件夹会清空状态', async () => {
    const { result } = setup()
    openFolder.mockResolvedValueOnce(snapshot(['a.md']))
    await act(async () => {
      await result.current.openFolder()
    })

    act(() => result.current.closeFolder())
    expect(result.current.root).toBeNull()
    expect(result.current.entries).toEqual([])
  })

  it('重命名成功后同步标签路径并刷新', async () => {
    const { result, callbacks } = setup()
    openFolder.mockResolvedValueOnce(snapshot(['a.md']))
    await act(async () => {
      await result.current.openFolder()
    })

    rename.mockResolvedValueOnce({
      ok: true,
      path: `${ROOT}/b.md`,
      previousPath: `${ROOT}/a.md`
    })
    load.mockResolvedValueOnce(snapshot(['b.md']))

    let ok = false
    await act(async () => {
      ok = await result.current.rename(`${ROOT}/a.md`, 'b.md')
    })

    expect(rename).toHaveBeenCalledWith(ROOT, `${ROOT}/a.md`, 'b.md')
    expect(ok).toBe(true)
    expect(callbacks.onRenamed).toHaveBeenCalledWith(`${ROOT}/a.md`, `${ROOT}/b.md`)
    expect(result.current.entries.map((entry) => entry.name)).toEqual(['b.md'])
  })

  it('重命名失败时按错误类型提示，且不动标签', async () => {
    const { result, callbacks } = setup()
    openFolder.mockResolvedValueOnce(snapshot(['a.md']))
    await act(async () => {
      await result.current.openFolder()
    })
    resetToasts()

    rename.mockResolvedValueOnce({ ok: false, error: 'exists' })
    let ok = true
    await act(async () => {
      ok = await result.current.rename(`${ROOT}/a.md`, 'b.md')
    })

    expect(ok).toBe(false)
    expect(callbacks.onRenamed).not.toHaveBeenCalled()
    expect(getToasts()[0]?.title).toContain('already exists')
  })

  it('删除成功后会关标签并刷新，脏状态会传给主进程', async () => {
    const isDirty = vi.fn(() => true)
    const { result, callbacks } = setup({ isDirty })
    openFolder.mockResolvedValueOnce(snapshot(['a.md']))
    await act(async () => {
      await result.current.openFolder()
    })

    remove.mockResolvedValueOnce({ ok: true })
    load.mockResolvedValueOnce(snapshot([]))
    let ok = false
    await act(async () => {
      ok = await result.current.remove(`${ROOT}/a.md`)
    })

    expect(remove).toHaveBeenCalledWith(ROOT, `${ROOT}/a.md`, true)
    expect(ok).toBe(true)
    expect(callbacks.onDeleted).toHaveBeenCalledWith(`${ROOT}/a.md`)
  })

  it('用户在确认框里取消时不提示错误、不关标签', async () => {
    const { result, callbacks } = setup()
    openFolder.mockResolvedValueOnce(snapshot(['a.md']))
    await act(async () => {
      await result.current.openFolder()
    })
    resetToasts()

    remove.mockResolvedValueOnce({ ok: false, canceled: true })
    let ok = true
    await act(async () => {
      ok = await result.current.remove(`${ROOT}/a.md`)
    })

    expect(ok).toBe(false)
    expect(getToasts()).toHaveLength(0)
    expect(callbacks.onDeleted).not.toHaveBeenCalled()
  })

  it('打开文件只做转发', async () => {
    const { result, callbacks } = setup()
    act(() => result.current.openFile(`${ROOT}/a.md`))
    expect(callbacks.onOpenFile).toHaveBeenCalledWith(`${ROOT}/a.md`)
  })

  it('启动时恢复上次打开的文件夹并通知上层', async () => {
    localStorage.setItem('biu-text:workspace-root', ROOT)
    load.mockResolvedValueOnce(snapshot(['a.md']))
    const onRestored = vi.fn()
    const { result } = setup({ onRestored })

    await waitFor(() => expect(result.current.root).toBe(ROOT))
    expect(load).toHaveBeenCalledWith(ROOT)
    expect(result.current.entries.map((entry) => entry.name)).toEqual(['a.md'])
    expect(onRestored).toHaveBeenCalledTimes(1)
  })

  it('记录的文件夹已不可用时清掉记录，也不通知上层', async () => {
    localStorage.setItem('biu-text:workspace-root', ROOT)
    load.mockResolvedValueOnce(null)
    const onRestored = vi.fn()
    const { result } = setup({ onRestored })

    await waitFor(() => expect(localStorage.getItem('biu-text:workspace-root')).toBeNull())
    expect(onRestored).not.toHaveBeenCalled()
    expect(result.current.root).toBeNull()
  })

  it('打开文件夹写入记录，关闭文件夹清掉记录', async () => {
    const { result } = setup()
    openFolder.mockResolvedValueOnce(snapshot(['a.md']))
    await act(async () => {
      await result.current.openFolder()
    })
    expect(localStorage.getItem('biu-text:workspace-root')).toBe(ROOT)

    act(() => result.current.closeFolder())
    expect(localStorage.getItem('biu-text:workspace-root')).toBeNull()
  })
})

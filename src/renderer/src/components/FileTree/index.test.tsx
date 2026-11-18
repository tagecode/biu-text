/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import '@/i18n'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceEntry } from '@shared/workspace'
import { FileTree } from './index'

afterEach(cleanup)

const entries: WorkspaceEntry[] = [
  {
    path: '/notes/docs',
    name: 'docs',
    type: 'directory',
    children: [
      { path: '/notes/docs/guide.md', name: 'guide.md', type: 'file' },
      { path: '/notes/docs/spec.md', name: 'spec.md', type: 'file' }
    ]
  },
  { path: '/notes/readme.md', name: 'readme.md', type: 'file' }
]

function setup(overrides: Partial<React.ComponentProps<typeof FileTree>> = {}) {
  const props: React.ComponentProps<typeof FileTree> = {
    root: '/notes',
    entries,
    loading: false,
    activePath: null,
    onOpenFile: vi.fn(),
    onOpenFolder: vi.fn(),
    onRefresh: vi.fn(),
    onCloseFolder: vi.fn(),
    onRename: vi.fn(async () => true),
    onRemove: vi.fn(async () => true),
    ...overrides
  }
  render(<FileTree {...props} />)
  return props
}

describe('FileTree', () => {
  it('没有打开文件夹时显示空状态与打开按钮', () => {
    const props = setup({ root: null, entries: [] })
    expect(screen.getByText('No folder opened yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }))
    expect(props.onOpenFolder).toHaveBeenCalledTimes(1)
  })

  it('第一层目录默认展开，点击文件回调路径', () => {
    const props = setup()
    // 顶层目录默认展开，子文件直接可见
    expect(screen.getByText('guide.md')).toBeTruthy()

    fireEvent.click(screen.getByText('readme.md'))
    expect(props.onOpenFile).toHaveBeenCalledWith('/notes/readme.md')
  })

  it('点击目录可以折叠与展开', () => {
    setup()
    const directory = screen.getByRole('treeitem', { name: /docs/ })
    expect(directory.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(directory)
    expect(screen.queryByText('guide.md')).toBeNull()

    fireEvent.click(directory)
    expect(screen.getByText('guide.md')).toBeTruthy()
  })

  it('活动文件高亮', () => {
    setup({ activePath: '/notes/docs/spec.md' })
    const active = screen.getByRole('treeitem', { name: /spec\.md/ })
    expect(active.getAttribute('aria-selected')).toBe('true')
    const other = screen.getByRole('treeitem', { name: /readme\.md/ })
    expect(other.getAttribute('aria-selected')).toBe('false')
  })

  it('右键出现重命名与删除菜单', () => {
    setup()
    fireEvent.contextMenu(screen.getByText('readme.md'))

    expect(screen.getByRole('menuitem', { name: /Rename/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeTruthy()
  })

  it('删除会带路径回调（确认框在主进程）', async () => {
    const props = setup()
    fireEvent.contextMenu(screen.getByText('readme.md'))
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }))

    await waitFor(() => expect(props.onRemove).toHaveBeenCalledWith('/notes/readme.md'))
  })

  it('重命名对话框预填原名，提交后回调新名字', async () => {
    const props = setup()
    fireEvent.contextMenu(screen.getByText('readme.md'))
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))

    const input = (await screen.findByLabelText('New name')) as HTMLInputElement
    expect(input.value).toBe('readme.md')

    fireEvent.change(input, { target: { value: 'README.md' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    await waitFor(() => expect(props.onRename).toHaveBeenCalledWith('/notes/readme.md', 'README.md'))
  })

  it('名称没变时直接关闭对话框，不调用重命名', async () => {
    const props = setup()
    fireEvent.contextMenu(screen.getByText('readme.md'))
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))

    const input = await screen.findByLabelText('New name')
    fireEvent.change(input, { target: { value: 'readme.md' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    await waitFor(() => expect(props.onRename).not.toHaveBeenCalled())
  })

  it('对话框标题带上文件名，输入框预选主文件名', async () => {
    setup()
    fireEvent.contextMenu(screen.getByText('readme.md'))
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))

    expect(await screen.findByText('Rename “readme.md”')).toBeTruthy()
    const input = (await screen.findByLabelText('New name')) as HTMLInputElement
    // 只选中 "readme"，扩展名保留（选区在下一帧设置）
    await waitFor(() => {
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe('readme'.length)
    })
  })

  it('非法名称就地提示并禁用确认按钮', async () => {
    const props = setup()
    fireEvent.contextMenu(screen.getByText('readme.md'))
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))

    const input = await screen.findByLabelText('New name')
    fireEvent.change(input, { target: { value: 'bad/name.md' } })

    expect(screen.getByText('Name cannot be empty or contain path separators')).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const confirm = screen.getByRole('button', { name: 'Rename' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    // 改回合法名称后恢复可提交
    fireEvent.change(input, { target: { value: 'good-name.md' } })
    expect(screen.queryByText('Name cannot be empty or contain path separators')).toBeNull()
    expect((screen.getByRole('button', { name: 'Rename' }) as HTMLButtonElement).disabled).toBe(
      false
    )
    expect(props.onRename).not.toHaveBeenCalled()
  })

  it('工具栏按钮用于刷新与关闭文件夹', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(props.onRefresh).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close folder' }))
    expect(props.onCloseFolder).toHaveBeenCalledTimes(1)
  })
})

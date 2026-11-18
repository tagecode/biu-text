import path from 'node:path'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import { test } from './electron'
import { expectDialogSkeleton } from './dialog-skeleton'

/** 原生目录选择框直接返回给定目录，并触发「文件 → 打开文件夹」 */
async function openFolder(
  electronApp: ElectronApplication,
  window: Page,
  folder: string
): Promise<void> {
  await electronApp.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] })
  }, folder)
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('menu:open-folder')
  })
  await expect(window.getByRole('tree')).toBeVisible()
}

const SIDEBAR_PREF_KEY = 'biu-text:sidebar-visible'

/**
 * 文件树回归：
 * 打开文件夹 → 只列 Markdown → 点开文件 → 右键重命名（标签路径同步）→ 删除（标签关闭）。
 *
 * 目录选择框和删除确认框都是原生对话框，这里用 `electronApp.evaluate` 直接替换掉，
 * 避免测试卡在无人点击的模态窗口上。
 */
test('file tree: open folder, open file, rename and delete', async ({ window, electronApp }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-ws-e2e-'))
  await mkdir(path.join(dir, 'docs'), { recursive: true })
  await writeFile(path.join(dir, 'readme.md'), '# 根目录说明\n\n正文。\n', 'utf-8')
  await writeFile(path.join(dir, 'docs', 'guide.md'), '# 指南\n', 'utf-8')
  await writeFile(path.join(dir, 'cover.png'), 'binary', 'utf-8')
  await mkdir(path.join(dir, 'node_modules', 'pkg'), { recursive: true })
  await writeFile(path.join(dir, 'node_modules', 'pkg', 'readme.md'), '# pkg', 'utf-8')

  await openFolder(electronApp, window, dir)

  const tree = window.getByRole('tree')
  // 只列 Markdown 与包含它的目录
  await expect(tree.getByText('readme.md')).toBeVisible()
  await expect(tree.getByText('guide.md')).toBeVisible()
  await expect(tree.getByText('cover.png')).toHaveCount(0)
  await expect(tree.getByText('node_modules')).toHaveCount(0)

  // 点开文件 → 新标签
  await tree.getByText('readme.md').click()
  await expect(window.getByRole('tab', { name: /readme\.md/ })).toBeVisible()

  // 右键重命名：树和标签都要跟着变
  await tree.getByText('readme.md').click({ button: 'right' })
  await window.getByRole('menuitem', { name: /Rename/ }).click()

  // 对话框骨架：标题栏 + 关闭按钮 + 有内边距的表单 + 右对齐按钮
  const dialog = window.getByRole('dialog')
  await expectDialogSkeleton(dialog, { title: /Rename “readme\.md”/, action: /Rename/ })
  await window.screenshot({ path: 'test-results/rename-dialog.png' })

  const nameInput = window.getByLabel('New name')
  await nameInput.fill('README.md')
  await window.getByRole('button', { name: 'Rename', exact: true }).click()

  await expect(tree.getByText('README.md')).toBeVisible()
  await expect(window.getByRole('tab', { name: /README\.md/ })).toBeVisible()
  expect((await readdir(dir)).includes('README.md')).toBe(true)

  await window.screenshot({ path: 'test-results/workspace.png' })

  // 删除：确认框直接确认，文件移到回收站、标签关掉
  await electronApp.evaluate(({ dialog }) => {
    dialog.showMessageBox = (async () => ({ response: 0, checkboxChecked: false })) as never
  })
  await tree.getByText('README.md').click({ button: 'right' })
  await window.getByRole('menuitem', { name: /Delete/ }).click()

  await expect(tree.getByText('README.md')).toHaveCount(0)
  await expect(window.getByRole('tab', { name: /README\.md/ })).toHaveCount(0)
  expect((await readdir(dir)).includes('README.md')).toBe(false)

  await rm(dir, { recursive: true, force: true })
})

/**
 * 启动时应当恢复上次打开的文件夹（否则侧边栏会是一个空的空状态）。
 * 重载渲染进程即可模拟"重新启动"：localStorage 还在，主进程状态也在。
 */
test('reopens the last opened folder after a reload', async ({ window, electronApp }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-ws-restore-'))
  await writeFile(path.join(dir, 'note.md'), '# note\n', 'utf-8')

  await openFolder(electronApp, window, dir)
  await expect(window.getByRole('tree').getByText('note.md')).toBeVisible()

  await window.reload()

  await expect(window.getByRole('tree')).toBeVisible()
  await expect(window.getByRole('tree').getByText('note.md')).toBeVisible()

  await rm(dir, { recursive: true, force: true })
})

/**
 * 显示状态要一起记住：手动收起后重启，侧边栏必须还是收起的——
 * 但文件夹本身仍然被恢复（点开侧边栏就能看到它）。
 */
test('keeps a manually collapsed sidebar collapsed after a reload', async ({ window, electronApp }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-ws-collapsed-'))
  await writeFile(path.join(dir, 'note.md'), '# note\n', 'utf-8')

  await openFolder(electronApp, window, dir)
  await window.getByRole('button', { name: 'Hide file tree' }).click()
  await expect(window.getByRole('tree')).toHaveCount(0)
  expect(await window.evaluate((key) => localStorage.getItem(key), SIDEBAR_PREF_KEY)).toBe('false')

  await window.reload()

  await expect(window.getByRole('tab')).toHaveCount(1)
  await expect(window.getByRole('tree')).toHaveCount(0)
  // 文件夹确实恢复了：展开侧边栏就能看到内容
  await window.getByRole('button', { name: 'Show file tree' }).click()
  await expect(window.getByRole('tree').getByText('note.md')).toBeVisible()

  await rm(dir, { recursive: true, force: true })
})

/** 没有明确偏好时（旧版本升级上来 / 清过 localStorage），恢复文件夹应默认展开侧边栏 */
test('shows the sidebar on restore when there is no remembered preference', async ({
  window,
  electronApp
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-ws-default-'))
  await writeFile(path.join(dir, 'note.md'), '# note\n', 'utf-8')

  await openFolder(electronApp, window, dir)
  await window.evaluate((key) => localStorage.removeItem(key), SIDEBAR_PREF_KEY)

  await window.reload()

  await expect(window.getByRole('tree')).toBeVisible()
  await expect(window.getByRole('tree').getByText('note.md')).toBeVisible()

  await rm(dir, { recursive: true, force: true })
})

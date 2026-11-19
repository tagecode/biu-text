import path from 'node:path'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { ElectronApplication, Page } from '@playwright/test'
import { expect, test } from './electron'
import { openFolder } from './open-folder'

/**
 * 多标签页的端到端回归：
 * - 文件树点开两个文件 → 两个标签，Ctrl+1-9 切换；
 * - 每个标签的内容/脏标记互不串扰；
 * - 关脏标签走三态对话框，选「保存」后写盘再关闭；
 * - 选「取消」时标签保留、磁盘内容不变。
 */

async function resetToWelcome(window: Page): Promise<void> {
  await window.reload()
  await window.getByRole('button', { name: 'Export HTML' }).first().waitFor()
}

/** 把关闭确认对话框固定成指定结果（0 保存 / 1 不保存 / 2 取消） */
async function mockCloseChoice(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, value) => {
    dialog.showMessageBox = (async () => ({ response: value, checkboxChecked: false })) as never
  }, response)
}

async function typeIntoActiveEditor(window: Page, text: string): Promise<void> {
  await window.locator('.cm-content:visible').click()
  await window.keyboard.press('ControlOrMeta+End')
  await window.keyboard.insertText(text)
}

test('tabs: switch between documents and save a dirty tab on close', async ({
  electronApp,
  window
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-tabs-e2e-'))
  const fileA = path.join(dir, 'a.md')
  const fileB = path.join(dir, 'b.md')
  await writeFile(fileA, '# A\n\n第一部分\n', 'utf-8')
  await writeFile(fileB, '# B\n\n第二部分\n', 'utf-8')

  try {
    await resetToWelcome(window)
    await openFolder(electronApp, window, dir)

    const tree = window.getByRole('tree')
    const previewHeading = window.locator('article.markdown-body h1')

    await tree.getByText('a.md').click()
    await expect(window.getByRole('tab', { name: /a\.md/ })).toBeVisible()
    await expect(previewHeading).toHaveText('A')

    await tree.getByText('b.md').click()
    await expect(window.getByRole('tab', { name: /b\.md/ })).toBeVisible()
    await expect(previewHeading).toHaveText('B')

    // Ctrl+1 是欢迎标签，Ctrl+2 才是 a.md
    await window.keyboard.press('ControlOrMeta+2')
    await expect(window.getByRole('tab', { name: /a\.md/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(previewHeading).toHaveText('A')

    // 在 a 里输入：只有 a 出现脏标记
    await typeIntoActiveEditor(window, '\n\nEdited in A.')
    await expect(window.getByTestId('tab-dirty')).toHaveCount(1)

    // 切到 b：内容与脏标记互不影响
    await window.keyboard.press('ControlOrMeta+3')
    await expect(previewHeading).toHaveText('B')
    await expect(window.locator('.cm-content:visible')).not.toContainText('Edited in A.')
    await expect(window.getByTestId('tab-dirty')).toHaveCount(1)

    // 切回 a：内容还在
    await window.keyboard.press('ControlOrMeta+2')
    await expect(window.locator('.cm-content:visible')).toContainText('Edited in A.')

    // 关脏标签选「保存」：写盘后标签消失，活动标签落到右边的 b
    await mockCloseChoice(electronApp, 0)
    await window.getByRole('button', { name: 'Close tab a.md' }).click()
    await expect(window.getByRole('tab', { name: /a\.md/ })).toHaveCount(0)
    await expect.poll(async () => readFile(fileA, 'utf-8')).toContain('Edited in A.')
    await expect(previewHeading).toHaveText('B')
    await expect(window.getByTestId('tab-dirty')).toHaveCount(0)
  } finally {
    await rm(dir, { recursive: true, force: true })
    await resetToWelcome(window)
  }
})

test('tabs: cancelling the close dialog keeps the dirty tab', async ({ electronApp, window }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-tabs-cancel-'))
  const file = path.join(dir, 'note.md')
  await writeFile(file, '# Note\n\n原始内容\n', 'utf-8')

  try {
    await resetToWelcome(window)
    await openFolder(electronApp, window, dir)

    await window.getByRole('tree').getByText('note.md').click()
    await expect(window.getByRole('tab', { name: /note\.md/ })).toBeVisible()
    await typeIntoActiveEditor(window, '\n\n未保存的修改')
    await expect(window.getByTestId('tab-dirty')).toHaveCount(1)

    // 2 = 取消：标签必须还在，磁盘也不能被写
    await mockCloseChoice(electronApp, 2)
    await window.getByRole('button', { name: 'Close tab note.md' }).click()
    await expect(window.getByRole('tab', { name: /note\.md/ })).toBeVisible()
    await expect(window.getByTestId('tab-dirty')).toHaveCount(1)
    expect(await readFile(file, 'utf-8')).not.toContain('未保存的修改')
  } finally {
    await rm(dir, { recursive: true, force: true })
    await resetToWelcome(window)
  }
})

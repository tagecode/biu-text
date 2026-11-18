import { expect, test } from './electron'
import { expectDialogSkeleton } from './dialog-skeleton'

/**
 * 弹窗骨架回归：设置面板、导出预览、文件树重命名。
 * 三者都用同一个 `DialogContent`，但布局约束不同（普通弹窗 / 近全屏 / 小对话框）。
 */
test('settings panel keeps its dialog skeleton', async ({ window }) => {
  await window.getByRole('button', { name: 'Open Settings' }).click()
  const dialog = window.getByRole('dialog')
  await expectDialogSkeleton(dialog, { title: 'Settings', action: 'Save settings' })

  // 内容区可滚动且留了内边距（贴边 bug 的另一个形态）
  const body = dialog.locator('div').filter({ hasText: 'General' }).first()
  await expect(body).toBeVisible()

  await window.screenshot({ path: 'test-results/settings-dialog.png' })

  // Esc 关闭
  await window.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('export preview keeps its dialog skeleton', async ({ window }) => {
  await window.getByRole('button', { name: 'Export HTML' }).click()
  const dialog = window.getByRole('dialog')
  await expectDialogSkeleton(dialog, { title: 'Export preview', action: /Export PDF/ })

  // 「这里看到的就是将要导出的版面」：等 iframe 真的画出文档，而不是停在准备中
  const preview = window.frameLocator('iframe')
  await expect(preview.getByRole('heading', { name: 'Welcome to BiuText' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Export HTML' })).toBeEnabled()

  await window.screenshot({ path: 'test-results/export-preview-dialog.png' })

  await window.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
})

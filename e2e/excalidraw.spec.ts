import { expect, test } from './electron'
import { expectDialogSkeleton } from './dialog-skeleton'

/**
 * 手绘图端到端：
 * 工具栏打开 Excalidraw → 画一个矩形 → 插入 → 文档里出现 excalidraw 代码块 → 预览渲染成 SVG。
 *
 * 这里走的是真实 Excalidraw（懒加载 + 真实 SVG 导出），因此同时覆盖了
 * 「依赖能否在 Electron 里跑起来」和「导出的 SVG 能否被预览水合」两件事。
 */
test('insert a drawing and render it in the preview', async ({ window }) => {
  await window.getByRole('button', { name: 'Insert Drawing' }).click()
  const dialog = window.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expectDialogSkeleton(dialog, { title: 'Insert drawing', action: 'Insert' })

  // 懒加载的 1.7MB 依赖首次挂载会慢一些
  const canvas = dialog.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 30_000 })

  // 选矩形工具，然后在画布上拖出一个矩形。
  // Excalidraw 的工具按钮内部有 icon 子元素会拦截命中测试，这里直接 force 点它。
  await dialog.locator('[data-testid="toolbar-rectangle"]').click({ force: true })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas has no bounding box')
  await window.mouse.move(box.x + 120, box.y + 120)
  await window.mouse.down()
  await window.mouse.move(box.x + 320, box.y + 240, { steps: 12 })
  await window.mouse.up()

  const insert = dialog.getByRole('button', { name: 'Insert' })
  await expect(insert).toBeEnabled()
  await window.screenshot({ path: 'test-results/excalidraw-dialog.png' })
  await insert.click()

  // 文档里写入的是 excalidraw 代码块
  await expect(dialog).toHaveCount(0)
  await expect(window.locator('.cm-content')).toContainText('```excalidraw')

  // 预览把场景渲染成 SVG（真实调用 exportToSvg）
  const diagram = window.locator('.biu-diagram[data-diagram-lang="excalidraw"]')
  await expect(diagram).toHaveAttribute('data-diagram-state', 'ready', { timeout: 30_000 })
  await expect(diagram.locator('svg')).toHaveCount(1)
  await window.screenshot({ path: 'test-results/excalidraw-preview.png' })
})

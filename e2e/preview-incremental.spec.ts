import { expect } from '@playwright/test'
import { test } from './electron'

/**
 * 增量预览的端到端回归：
 * 改一段别的文字，已经水合好的图表 SVG 必须原样留在 DOM 里（不是重画、更不是被清掉）。
 */
test('incremental preview keeps hydrated diagrams', async ({ window }) => {
  const editor = window.locator('.cm-content')
  await editor.click()
  await window.keyboard.press('Control+a')
  await window.keyboard.press('Backspace')

  // 先用工具栏插入 mermaid 脚手架，避免逐字符敲反引号触发自动配对
  await window.getByRole('button', { name: 'Insert Mermaid Diagram' }).click()

  const diagram = window.locator('.biu-diagram')
  await expect(diagram).toHaveCount(1)
  await expect(diagram).toHaveAttribute('data-diagram-state', 'ready')
  await expect(diagram.locator('svg')).toHaveCount(1)

  // 给已水合的 SVG 打个标记：后面只要它还在，就说明节点没被重建
  await window.evaluate(() => {
    document.querySelector('.biu-diagram svg')?.setAttribute('data-e2e-marker', 'keep-me')
  })

  // 在图表**之前**插入标题与段落（光标此时在文档末尾，用 Ctrl+Home 回到开头）
  await window.keyboard.press('Control+Home')
  await window.keyboard.type('# 标题\n\n第一段内容。\n\n')
  await expect(window.locator('.markdown-body h1')).toHaveText('标题')
  await expect(window.locator('.markdown-body p').first()).toHaveText('第一段内容。')

  // 光标仍在插入内容末尾，再补一段（带上结尾空行，避免和后面的围栏粘在同一行）
  await window.keyboard.type('补充一段。\n\n')
  await expect(window.locator('.markdown-body p').last()).toHaveText('补充一段。')

  // 图表节点与状态必须原样保留
  await expect(window.locator('.biu-diagram svg')).toHaveAttribute('data-e2e-marker', 'keep-me')
  await expect(diagram).toHaveAttribute('data-diagram-state', 'ready')

  await window.screenshot({ path: 'test-results/incremental-after.png' })
})

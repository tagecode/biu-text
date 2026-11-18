import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { expect } from '@playwright/test'
import { test } from './electron'

/**
 * 大文档首屏测量（默认不跑，避免 CI 因机器差异抖动）：
 *
 *   BIU_PERF=1 BIU_PERF_SIZE=5 npx playwright test e2e/perf.spec.ts
 *
 * 为什么必须在真实 Electron 里测：jsdom 的 DOMPurify 每次调用会保留大量内存、
 * 且小块文本下固定开销远高于 Chromium，合成基准会把"逐块消毒"算得离谱地慢。
 * 这里量的是真实引擎下的：打开文件 → 预览首帧 → 全部渲染完成。
 */

const SIZE_MB = Number(process.env.BIU_PERF_SIZE ?? '1')

/**
 * 接近真实写作的分块：每个块 300~600 字节（真实散文的段落在几百字节量级）。
 * 早先每块只有 80 字节的合成文档会产出 2 万多个顶层节点，属于极端情况，
 * 拿它当"1MB 文档"会把数字压得很低。
 */
function synth(targetBytes: number): string {
  const filler = '这是一段用于测量的正文，混入 English words 与 `inline code`，模拟真实写作里的段落长度与混合排版。'.repeat(
    4
  )
  const parts: string[] = []
  let bytes = 0
  let index = 0
  while (bytes < targetBytes) {
    const block = [
      `## 小节 ${index}`,
      '',
      filler,
      '',
      `- 条目 ${index}-a`,
      `- 条目 ${index}-b`,
      '',
      '| 名称 | 数值 |',
      '| --- | --- |',
      `| alpha-${index} | ${index} |`,
      '',
      ''
    ].join('\n')
    parts.push(block)
    bytes += Buffer.byteLength(block)
    index++
  }
  return parts.join('')
}

test.skip(process.env.BIU_PERF !== '1', 'perf 测量默认不跑（BIU_PERF=1 开启）')

test(`measures first paint for a ${SIZE_MB}MB document`, async ({ window, electronApp }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-perf-'))
  const file = path.join(dir, 'big.md')
  await writeFile(file, synth(SIZE_MB * 1024 * 1024), 'utf-8')

  // 先起测量再触发打开：只认打开之后新挂载的那个 <article>（换标签会重挂载预览）
  const measure = window.evaluate(async () => {
    const start = performance.now()
    const before = document.querySelector('article.markdown-body')
    let firstAt = 0
    let lastCount = -1
    let stable = 0
    let doneAt = 0

    await new Promise<void>((resolve) => {
      const tick = (): void => {
        const article = document.querySelector('article.markdown-body')
        const count = article && article !== before ? article.children.length : 0
        if (count > 0 && firstAt === 0) firstAt = performance.now() - start
        if (count === lastCount) stable++
        else {
          stable = 0
          lastCount = count
        }
        if (count > 0 && stable >= 10) {
          doneAt = performance.now() - start
          resolve()
          return
        }
        if (performance.now() - start > 120_000) {
          doneAt = -1
          resolve()
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    return { firstAt, doneAt, blocks: lastCount }
  })

  await electronApp.evaluate(({ BrowserWindow }, filePath) => {
    BrowserWindow.getAllWindows()[0].webContents.send('menu:open-recent', filePath)
  }, file)

  const result = await measure
  console.log(
    `[perf] ${SIZE_MB}MB  预览首帧 ${result.firstAt.toFixed(0)}ms  渲染完成 ${result.doneAt.toFixed(0)}ms  顶层元素 ${result.blocks}`
  )

  expect(result.doneAt).toBeGreaterThan(0)
  expect(result.blocks).toBeGreaterThan(100)

  await rm(dir, { recursive: true, force: true })
})

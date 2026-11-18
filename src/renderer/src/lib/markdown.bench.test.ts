/** @vitest-environment jsdom */
/**
 * 预览渲染基准，默认跳过（`npm test` 与 CI 都不会跑）。
 *
 *   BIU_BENCH=1 npx vitest run src/renderer/src/lib/markdown.bench.test.ts
 *
 * ⚠️ 只适合看**相对关系**（增量 vs 全量、改一段 vs 整篇），不要引用绝对值：
 * jsdom 的 `DOMPurify.sanitize` 每次调用都会保留可观的内存（2MB 文档就能把 4GB 堆打爆），
 * 小块文本下的固定开销也远高于 Chromium。真实引擎下的首帧/填完耗时请用
 * `BIU_PERF=1 npx playwright test e2e/perf.spec.ts` 测。
 */
import '@/test/dom-polyfills'
import { describe, expect, it } from 'vitest'
import DOMPurify from 'dompurify'
import { renderMarkdown } from './markdown'
import { BlockRenderer } from './block-renderer'
import { IncrementalSplitter, splitMarkdownSpans } from './markdown-blocks'
import { countWords } from '@/hooks/useWordCount'

const RUNS = 3

/**
 * 生成**每块都不同**的文档。
 *
 * 这点很关键：早先用「同一段文本重复 N 次」的合成文档，绝大多数块会命中缓存，
 * 量出来的是缓存查找成本而不是渲染成本，数字会好看得很假。
 */
function synthMarkdown(targetBytes: number): string {
  const parts: string[] = []
  let bytes = 0
  let index = 0
  while (bytes < targetBytes) {
    const block = [
      `## 小节 ${index}`,
      '',
      `第 ${index} 段正文，混入 English words 与 \`inline code\`，模拟真实写作的段落。`,
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

function timeOnce(fn: () => void): number {
  const start = performance.now()
  fn()
  return performance.now() - start
}

function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
}

function timeMedian(fn: () => void, runs = RUNS): number {
  fn()
  return median(Array.from({ length: runs }, () => timeOnce(fn)))
}

/** 模拟真实编辑：在文档中间插一段文字，其它内容不变 */
function editMiddle(source: string, marker: string): string {
  const index = source.indexOf(marker)
  const insertAt = index === -1 ? source.length / 2 : index
  return `${source.slice(0, insertAt)}\n新增的一小段。\n${source.slice(insertAt)}`
}

describe.skipIf(process.env.BIU_BENCH !== '1')('preview render baseline', () => {
  it('records the old (whole-document) and new (per-block) pipelines', () => {
    for (const megabytes of [1]) {
      const source = synthMarkdown(megabytes * 1024 * 1024)
      const label = (Buffer.byteLength(source) / 1024 / 1024).toFixed(2)

      // 旧管线：整篇 renderMarkdown + DOMPurify
      const sanitizeMs = timeMedian(() => {
        const raw = renderMarkdown(source, { diagrams: [] })
        DOMPurify.sanitize(raw)
      }, 1)

      // 切块：整篇 vs 增量（改一段）
      const splitFullMs = timeMedian(() => {
        splitMarkdownSpans(source)
      })
      const splitter = new IncrementalSplitter()
      splitter.split(source)
      let editedForSplit = source
      const splitIncrementalSamples: number[] = []
      for (let run = 0; run < RUNS; run++) {
        editedForSplit = editMiddle(editedForSplit, '## 小节标题')
        splitIncrementalSamples.push(timeOnce(() => splitter.split(editedForSplit)))
      }
      const splitIncrementalMs = median(splitIncrementalSamples)

      // 字数统计（单遍扫描）
      const wordCountMs = timeMedian(() => {
        countWords(source)
      })

      // 新管线：不分帧一次性渲染（作为对照）+ 分帧首屏
      const renderer = new BlockRenderer()
      const firstMs = timeOnce(() => {
        renderer.render(source, { documentPath: 'C:/notes/bench.md' })
      })
      const blockCount = splitMarkdownSpans(source).spans.length

      const progressive = new BlockRenderer()
      const progressStart = performance.now()
      let chunk = progressive.render(source, { documentPath: 'C:/notes/bench.md' }, 12)
      const firstFrameMs = performance.now() - progressStart
      const firstFrameBlocks = chunk.blocks.length
      let frames = 1
      while (!chunk.done && frames < 100_000) {
        chunk = progressive.render(source, { documentPath: 'C:/notes/bench.md' }, 12)
        frames++
      }
      const allFramesMs = performance.now() - progressStart

      // 新管线再次渲染（无改动）
      const unchangedMs = timeMedian(() => {
        renderer.render(source, { documentPath: 'C:/notes/bench.md' })
      })

      // 新管线：真实编辑（反复改动中间一段）
      let edited = source
      const editSamples: number[] = []
      for (let run = 0; run < RUNS; run++) {
        edited = editMiddle(edited, '## 小节标题')
        editSamples.push(
          timeOnce(() => {
            renderer.render(edited, { documentPath: 'C:/notes/bench.md' })
          })
        )
      }
      const editMs = median(editSamples)

      console.log(
        `[bench] ${label}MB blocks=${blockCount} | 旧管线(整篇) ${sanitizeMs.toFixed(0)}ms | ` +
          `整篇渲染 ${firstMs.toFixed(0)}ms | 分帧首帧 ${firstFrameMs.toFixed(1)}ms(${firstFrameBlocks} 块)/` +
          `${frames} 帧完成 ${allFramesMs.toFixed(0)}ms | 无改动 ${unchangedMs.toFixed(1)}ms | ` +
          `改一段 ${editMs.toFixed(1)}ms | 切块 整篇 ${splitFullMs.toFixed(1)}ms / 增量 ${splitIncrementalMs.toFixed(1)}ms | ` +
          `字数 ${wordCountMs.toFixed(1)}ms`
      )
    }
    expect(true).toBe(true)
  }, 300_000)
})

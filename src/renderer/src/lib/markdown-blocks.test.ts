/** @vitest-environment jsdom */
import '@/test/dom-polyfills'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderMarkdown } from './markdown'
import {
  IncrementalSplitter,
  splitMarkdownSpans,
  type MarkdownSpan,
  type SpanSplitResult
} from './markdown-blocks'

/**
 * 等价性语料：分段渲染的价值完全取决于「逐块拼接 === 整篇渲染」。
 * 同时覆盖可分段与必须回退两类，任何一条失守都说明切分边界判断有空洞。
 */
const snippets: Record<string, string> = {
  paragraphs: '# 标题\n\n第一段。\n\n第二段，含 `code` 与 **粗体**。\n',
  listsTight: '- a\n- b\n- c\n',
  listsLoose: '- a\n\n- b\n\n- c\n',
  ordered: '1. a\n\n2. b\n',
  orderedLoose: '1. a\n\n   - 子项\n\n2. b\n',
  mixedMarkers: '- a\n\n* b\n',
  nested: '- a\n  - a1\n  - a2\n- b\n',
  table: '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n段落\n',
  fenced: '```ts\nconst a = 1\n\nconst b = 2\n```\n\n段落\n',
  fencedThenList: '```\ncode\n```\n\n- a\n\n- b\n',
  quote: '> 引用一\n\n> 引用二\n',
  thematic: '段落\n\n---\n\n段落\n',
  setext: '标题\n===\n\n段落\n',
  inlineHtml: '段落里有 <span>x</span>。\n\n下一段\n',
  emoji: '段落 :smile: 结束\n\n下一段\n',
  katex: '公式 $a^2+b^2=c^2$ 行内\n\n$$\nE=mc^2\n$$\n',
  listThenParagraph: '- a\n\n段落\n',
  indentedCode: '段落\n\n    code line\n\n段落\n',
  indentedFence: '  ```ts\n  const a = 1\n\n  const b = 2\n  ```\n\n段落\n',
  indentedRefLink: ' [foo]: /url\n\n使用 [foo]。\n',
  indentedFootnote: '文本[^1]\n\n [^1]: 脚注内容\n',
  indentedHtml: '  <div>\n\n中间\n\n  </div>\n',
  lazyList: '- item\nlazy\n\n- next\n',
  lazyOrdered: '1. a\nlazy\n\n2. b\n',
  taskList: '- [ ] a\n\n- [x] b\n',
  refLink: '[foo]: /url "title"\n\n使用 [foo] 链接。\n',
  footnote: '文本[^1]\n\n[^1]: 脚注内容\n',
  htmlBlock: '<div>\n\n中间\n\n</div>\n'
}

function textsOf(content: string, spans: readonly MarkdownSpan[]): string[] {
  return spans.map((span) => content.slice(span.start, span.end))
}

function renderByBlocks(content: string): string {
  const { spans } = splitMarkdownSpans(content)
  return textsOf(content, spans)
    .map((text) => renderMarkdown(text, { diagrams: [] }))
    .join('')
}

describe('splitMarkdownSpans', () => {
  it('空文档不产生块', () => {
    const result = splitMarkdownSpans('   \n\n  ')
    expect(result.segmented).toBe(true)
    expect(result.spans).toEqual([])
  })

  it('普通段落按空行切块', () => {
    const content = '# 标题\n\n段落一\n\n段落二'
    expect(textsOf(content, splitMarkdownSpans(content).spans)).toEqual(['# 标题', '段落一', '段落二'])
  })

  it('围栏代码块内部不切', () => {
    const content = '```ts\nline1\n\nline2\n```\n\n段落'
    const texts = textsOf(content, splitMarkdownSpans(content).spans)
    expect(texts).toHaveLength(2)
    expect(texts[0]).toBe('```ts\nline1\n\nline2\n```')
  })

  it('松列表不切，保持一个块', () => {
    expect(splitMarkdownSpans('- a\n\n- b\n\n- c').spans).toHaveLength(1)
  })

  it('列表项后的缩进续行不切', () => {
    expect(splitMarkdownSpans('1. a\n\n   - 子项\n\n2. b').spans).toHaveLength(1)
  })

  it('引用定义出现时放弃分段', () => {
    const result = splitMarkdownSpans('[foo]: /url\n\n使用 [foo]。')
    expect(result.segmented).toBe(false)
    expect(result.reason).toContain('reference definition')
    expect(result.spans).toHaveLength(1)
  })

  it('脚注定义出现时放弃分段', () => {
    expect(splitMarkdownSpans('文本[^1]\n\n[^1]: 脚注').segmented).toBe(false)
  })

  it('原始 HTML 行出现时放弃分段', () => {
    expect(splitMarkdownSpans('段落\n\n<div>\n内容\n</div>').segmented).toBe(false)
  })

  it('1–3 空格缩进的引用定义 / 脚注 / 原始 HTML 同样放弃分段', () => {
    for (const source of [
      ' [foo]: /url\n\n使用 [foo]。',
      '文本[^1]\n\n [^1]: 脚注',
      '  <div>\n\n中间\n\n  </div>'
    ]) {
      expect(splitMarkdownSpans(source).segmented, source).toBe(false)
    }
  })

  it('1–3 空格缩进的围栏按围栏处理，不被内部空行切开', () => {
    const content = '  ```ts\n  code\n\n  more\n  ```'
    const spans = splitMarkdownSpans(content).spans
    expect(spans).toHaveLength(1)
    expect(content.slice(spans[0].start, spans[0].end)).toContain('more')
  })

  it('列表项的惰性续行不与后面的列表项切开', () => {
    expect(splitMarkdownSpans('- item\nlazy\n\n- next').spans).toHaveLength(1)
    expect(splitMarkdownSpans('1. a\nlazy\n\n2. b').spans).toHaveLength(1)
  })

  it('块 key 只由内容与上下文决定', () => {
    const a = splitMarkdownSpans('段落一\n\n段落二')
    const b = splitMarkdownSpans('段落一\n\n段落二')
    expect(a.spans.map((span) => span.key)).toEqual(b.spans.map((span) => span.key))

    const withContext = splitMarkdownSpans('段落一\n\n段落二', 'ctx')
    expect(withContext.spans[0].key).not.toBe(a.spans[0].key)
  })
})

describe('逐块渲染与整篇渲染等价', () => {
  it('语料：可分段时必须逐字节相同', () => {
    for (const [name, source] of Object.entries(snippets)) {
      const split = splitMarkdownSpans(source)
      if (!split.segmented) continue
      expect(renderByBlocks(source), name).toBe(renderMarkdown(source, { diagrams: [] }))
    }
  })

  it('语料：已知跨块构造必须被识别为不可分段', () => {
    for (const name of [
      'refLink',
      'footnote',
      'htmlBlock',
      'indentedRefLink',
      'indentedFootnote',
      'indentedHtml'
    ]) {
      expect(splitMarkdownSpans(snippets[name]).segmented, name).toBe(false)
    }
  })

  it('真实文档（PRD.md / Arch.md）可分段且逐字节相同', () => {
    for (const file of ['PRD.md', 'Arch.md']) {
      const content = readFileSync(path.join(process.cwd(), 'docs', file), 'utf-8')
      const split = splitMarkdownSpans(content)
      expect(split.segmented, `${file} 应当可分段（reason=${split.reason ?? ''}）`).toBe(true)
      expect(split.spans.length).toBeGreaterThan(10)
      expect(renderByBlocks(content), file).toBe(renderMarkdown(content, { diagrams: [] }))
    }
  })
})

function readDoc(file: string): string {
  return readFileSync(path.join(process.cwd(), 'docs', file), 'utf-8')
}

function expectSameSpans(actual: SpanSplitResult, expected: SpanSplitResult, label: string): void {
  expect(actual.segmented, `${label} segmented`).toBe(expected.segmented)
  expect(
    actual.spans.map((span) => [span.start, span.end, span.key]),
    `${label} spans`
  ).toEqual(expected.spans.map((span) => [span.start, span.end, span.key]))
}

describe('IncrementalSplitter', () => {
  const base = '# 标题\n\n第一段。\n\n- 列表一\n- 列表二\n\n```ts\ncode\n```\n\n第三段。\n'

  it('内容不变时结果稳定', () => {
    const splitter = new IncrementalSplitter()
    const first = splitter.split(base)
    const second = splitter.split(base)
    expect(second.spans).toEqual(first.spans)
  })

  it('在段落里追加文字只重扫一小段', () => {
    const splitter = new IncrementalSplitter()
    splitter.split(base)
    const edited = base.replace('第一段。', '第一段改过了。')
    expectSameSpans(splitter.split(edited), splitMarkdownSpans(edited), '追加文字')
  })

  it('文末追加段落', () => {
    const splitter = new IncrementalSplitter()
    splitter.split(base)
    const edited = `${base}\n新增的一段。`
    expectSameSpans(splitter.split(edited), splitMarkdownSpans(edited), '文末追加')
  })

  it('文首插入段落', () => {
    const splitter = new IncrementalSplitter()
    splitter.split(base)
    const edited = `开头插入的一段。\n\n${base}`
    expectSameSpans(splitter.split(edited), splitMarkdownSpans(edited), '文首插入')
  })

  it('删除空行会合并相邻段落', () => {
    const splitter = new IncrementalSplitter()
    const twoParas = '段落一\n\n段落二\n'
    splitter.split(twoParas)
    const merged = '段落一\n段落二\n'
    expectSameSpans(splitter.split(merged), splitMarkdownSpans(merged), '删除空行')
  })

  it('插入缩进代码行会与上一块粘连', () => {
    const splitter = new IncrementalSplitter()
    const content = '段落一\n\n段落二\n'
    splitter.split(content)
    const indented = '段落一\n\n   段落二\n'
    expectSameSpans(splitter.split(indented), splitMarkdownSpans(indented), '缩进代码行')
  })

  it('在围栏内部插入空行不会切出新块', () => {
    const splitter = new IncrementalSplitter()
    splitter.split(base)
    const edited = base.replace('```ts\ncode\n```', '```ts\ncode\n\nmore\n```')
    expectSameSpans(splitter.split(edited), splitMarkdownSpans(edited), '围栏内空行')
  })

  it('写入引用定义后整篇回退，删掉后恢复分段', () => {
    const splitter = new IncrementalSplitter()
    splitter.split(base)
    const withRef = `${base}\n[foo]: /url\n`
    const fallback = splitter.split(withRef)
    expect(fallback.segmented).toBe(false)
    expect(fallback.spans).toHaveLength(1)

    const withoutRef = splitter.split(base)
    expect(withoutRef.segmented).toBe(true)
    expectSameSpans(withoutRef, splitMarkdownSpans(base), '删掉引用定义')
  })

  it('上下文哈希变化会让所有 key 失效', () => {
    const splitter = new IncrementalSplitter()
    const first = splitter.split(base, 'a')
    const second = splitter.split(base, 'b')
    expect(second.spans.map((span) => span.key)).not.toEqual(first.spans.map((span) => span.key))
  })

  it('随机编辑性质测试：增量结果必须与从头切分完全一致', () => {
    const fragments = [
      '文字',
      ' ',
      '\n',
      '\n\n',
      '- 列表项',
      ' 1. 有序项',
      '  缩进行',
      '```',
      '`code`',
      '## 小标题',
      '| a | b |\n| --- | --- |',
      '[ref]: /url'
    ]

    // 固定种子的 PRNG，失败可复现
    const random = (() => {
      let seed = 0x9e3779b9
      return () => {
        seed ^= seed << 13
        seed ^= seed >>> 17
        seed ^= seed << 5
        return (seed >>> 0) / 0x100000000
      }
    })()

    for (const file of ['PRD.md', 'Arch.md']) {
      const original = readDoc(file)
      const splitter = new IncrementalSplitter()
      splitter.split(original)
      let content = original

      for (let step = 0; step < 40; step++) {
        const at = Math.floor(random() * content.length)
        const insert = random() < 0.6
        if (insert) {
          const fragment = fragments[Math.floor(random() * fragments.length)]
          content = content.slice(0, at) + fragment + content.slice(at)
        } else {
          const removeLength = 1 + Math.floor(random() * 40)
          content = content.slice(0, at) + content.slice(at + removeLength)
        }

        const incremental = splitter.split(content)
        const full = splitMarkdownSpans(content)
        expectSameSpans(incremental, full, `${file} step ${step}`)
      }

      // 确保这条性质测试真的在测增量路径，而不是每次都悄悄退回整篇重切
      const steps = 40
      expect(
        splitter.stats.incremental,
        `${file} 增量命中 ${splitter.stats.incremental}/${steps}`
      ).toBeGreaterThan(steps * 0.7)
    }
  }, 120_000)
})

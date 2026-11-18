import { describe, expect, it } from 'vitest'
import { countWords } from './useWordCount'

/** 旧实现的语义基准：正则两遍扫描，用来确认单遍扫描没有改变统计口径 */
function referenceCount(content: string): { words: number; chars: number; lines: number } {
  const lines = content === '' ? 0 : content.split('\n').length
  const chars = content.length
  const cjkMatches = content.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g)
  const cjkCount = cjkMatches ? cjkMatches.length : 0
  const withoutCjk = content.replace(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, ' ')
  const englishMatches = withoutCjk.match(/\b[a-zA-Z0-9]+\b/g)
  const englishCount = englishMatches ? englishMatches.length : 0
  return { words: cjkCount + englishCount, chars, lines }
}

const samples: Record<string, string> = {
  empty: '',
  chinese: '这是一段中文。',
  english: 'hello world from biutext',
  mixed: 'BiuText 是一款 Markdown 编辑器，支持 code 与 表情 😀。',
  punctuation: 'a, b; c:d - e_f (g) [h]',
  numbers: '2026 年 11 月 17 日，版本 v1.0.0',
  newlines: '第一行\n第二行\n\n空行之后',
  kana: 'これは テスト です',
  hangul: '이것은 테스트입니다',
  inlineCode: '使用 `countWords()` 函数统计，共 2 个词',
  url: 'https://example.com/path?q=1 与 http://a.b',
  surrogate: 'emoji 😀😀 后面还有 ascii'
}

describe('countWords', () => {
  it('与旧实现语义一致', () => {
    for (const [name, content] of Object.entries(samples)) {
      expect(countWords(content), name).toEqual(referenceCount(content))
    }
  })

  it('空文档三项都是 0', () => {
    expect(countWords('')).toEqual({ words: 0, chars: 0, lines: 0 })
  })

  it('中英文分别计数', () => {
    expect(countWords('中文abc').words).toBe(3) // 2 个汉字 + 1 个英文词
    expect(countWords('abc def').words).toBe(2)
    expect(countWords('中文').words).toBe(2)
    // 下划线是「单词字符」，e_f 不构成一个由 \b 包裹的英文词
    expect(countWords('e_f g').words).toBe(1)
  })

  it('行数按换行符计算', () => {
    expect(countWords('a\nb\nc').lines).toBe(3)
    expect(countWords('a\n').lines).toBe(2)
  })

  it('随机字符串也与旧实现一致', () => {
    const alphabet = 'ab Z9，。!?中文字\n\t-`[]()😀ㄱ가'
    let seed = 0x5eed
    const random = (): number => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      return (seed >>> 0) / 0x100000000
    }

    for (let round = 0; round < 200; round++) {
      let content = ''
      const length = Math.floor(random() * 60)
      for (let index = 0; index < length; index++) {
        content += alphabet[Math.floor(random() * alphabet.length)]
      }
      expect(countWords(content), JSON.stringify(content)).toEqual(referenceCount(content))
    }
  })
})

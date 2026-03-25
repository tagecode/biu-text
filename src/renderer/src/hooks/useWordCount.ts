import { useMemo } from 'react'

export interface WordCountResult {
  words: number
  chars: number
  lines: number
}

export function useWordCount(content: string): WordCountResult {
  return useMemo(() => {
    const lines = content === '' ? 0 : content.split('\n').length
    const chars = content.length

    // 中文字符每个算一个词，英文按空格分词
    const cjkMatches = content.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g)
    const cjkCount = cjkMatches ? cjkMatches.length : 0

    const withoutCjk = content.replace(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    const englishMatches = withoutCjk.match(/\b[a-zA-Z0-9]+\b/g)
    const englishCount = englishMatches ? englishMatches.length : 0

    return { words: cjkCount + englishCount, chars, lines }
  }, [content])
}
